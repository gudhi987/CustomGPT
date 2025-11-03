import "../styles/interaction.css";
import { useState, useEffect, useRef } from "react";
import TargetConfiguration from "./configuration";

function ChatbotInteraction() {
    const [configModalOpen, setConfigModalOpen] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [savedConfig, setSavedConfig] = useState(null);
    // Track all user/assistant messages with type (completion/chat)
    const [messages, setMessages] = useState([]);
    // Track current input
    const [inputValue, setInputValue] = useState("");
    const [inputHeight, setInputHeight] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        // Nothing to load initially; savedConfig remains null until user saves in this session.
    }, []);

    const handleOpenConfig = () => {
        setConfigModalOpen(true);
    };

    const handleCloseConfig = () => {
        setConfigModalOpen(false);
    };

    const handleSaved = (cfg) => {
        setIsSaved(true);
        setSavedConfig(cfg);
        // show transient toast and close modal
        showToast('Configuration saved');
        setConfigModalOpen(false);
    };

    const [toastMsg, setToastMsg] = useState("");
    const [toastVisible, setToastVisible] = useState(false);
    const toastTimerRef = useRef(null);

    const showToast = (msg, ms = 2500) => {
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current);
            toastTimerRef.current = null;
        }
        setToastMsg(msg);
        // small delay to ensure transition applies when re-showing
        requestAnimationFrame(() => setToastVisible(true));
        toastTimerRef.current = setTimeout(() => {
            setToastVisible(false);
            toastTimerRef.current = null;
        }, ms);
    };

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, []);

    async function submitUserRequest(event) {
            event.preventDefault();
            if (!isSaved) {
                showToast('Please configure and save your target before sending a message.', 2500);
                return;
            }
            const prompt = inputValue;
            console.log("Prompt submitted:", prompt);
            if (!prompt) {
                showToast('User input cannot be empty');
                return ;
            }

            // Determine model type from savedConfig
            const modelType = savedConfig?.modelType || 'completions';
            // Add user message
            setMessages(prev => [
                ...prev,
                { role: 'user', content: prompt, type: modelType }
            ]);
            setInputValue("");
            setInputHeight(1);

            // Prepare request for completion/chat
            let requestBody = {};
            let responsePath = savedConfig?.responsePath || '';
            let outputType = savedConfig?.outputType || 'json';
            let url = savedConfig?.url || '';
            let method = savedConfig?.method || 'POST';
            let headers = {};
            (savedConfig?.headerConfig || []).forEach(h => {
                if (h.key) headers[h.key] = h.value;
            });
            let queryParams = (savedConfig?.queryConfig || []).filter(q => q.key && q.value);
            let baseUrl = new URL(url);
            // Replace {{prompt}} in query parameters
            queryParams.forEach(q => {
                const paramValue = q.value.replace("{{prompt}}", encodeURIComponent(prompt));
                baseUrl.searchParams.append(q.key, paramValue);
            });

            if (modelType === 'chat') {
                // For chat, collect all chat messages since last completion
                let chatHistory = [];
                for (let i = messages.length - 1; i >= 0; i--) {
                    if (messages[i].type === 'completion') break;
                    chatHistory.unshift(messages[i]);
                }
                // Add current user message
                chatHistory.push({ role: 'user', content: prompt, type: 'chat' });
                requestBody = { messages: chatHistory.map(({ role, content }) => ({ role, content })) };
            } else {
                // For completions, just send the prompt
                requestBody = { prompt };
            }

            // If user provided a body template, merge/override
            if (savedConfig?.bodyContent) {
                try {
                    if (savedConfig.bodyContent.includes("{{prompt}}")) {
                        // Direct string replacement if {{prompt}} is in the body
                        if (savedConfig.bodyContent.trim().startsWith("{")) {
                            // For JSON body, parse first, then replace
                            let bodyTemplate = JSON.parse(savedConfig.bodyContent);
                            const replacePromptInObject = (obj) => {
                                Object.keys(obj).forEach(key => {
                                    if (typeof obj[key] === 'string') {
                                        obj[key] = obj[key].replace("{{prompt}}", prompt);
                                    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                                        replacePromptInObject(obj[key]);
                                    }
                                });
                            };
                            replacePromptInObject(bodyTemplate);
                            requestBody = bodyTemplate;
                        } else {
                            // For plain text body, simple replacement
                            requestBody = savedConfig.bodyContent.replace("{{prompt}}", prompt);
                        }
                    } else {
                        // No {{prompt}} found, use the old behavior
                        let bodyObj = JSON.parse(savedConfig.bodyContent);
                        if (modelType === 'chat') bodyObj.messages = requestBody.messages;
                        else bodyObj.prompt = prompt;
                        requestBody = bodyObj;
                    }
                } catch {
                    // fallback: treat as string and try prompt replacement
                    requestBody = savedConfig.bodyContent.replace("{{prompt}}", prompt);
                }
            }

            // Indicate processing state
            setIsProcessing(true);

            // Send request via proxy
            try {
                const proxyReq = {
                    url: baseUrl.href,
                    method,
                    headers,
                    body: requestBody,
                    responseType: outputType
                };
                const proxyResp = await fetch('http://localhost:3000/proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(proxyReq)
                });
                const envelope = await proxyResp.json();
                let bodyObj = envelope.body;
                if (typeof bodyObj === 'string' && outputType === 'json') {
                    try { bodyObj = JSON.parse(bodyObj); } catch {}
                }
                // Evaluate responsePath
                let extracted;
                try {
                    const fn = new Function('response', `return (${responsePath});`);
                    extracted = fn(bodyObj);
                } catch {
                    extracted = undefined;
                }
                setMessages(prev => [
                    ...prev,
                    { role: 'assistant', content: typeof extracted === 'undefined' ? '(no response)' : (typeof extracted === 'object' ? JSON.stringify(extracted, null, 2) : String(extracted)), type: modelType }
                ]);
            } catch (err) {
                setMessages(prev => [
                    ...prev,
                    { role: 'assistant', content: 'Error: ' + (err?.message || err), type: modelType }
                ]);
            }

            // Clear processing state
            setIsProcessing(false);
    }

    return (
        <div className="chat-interface">
            <header>
                <p>CustomGPT</p>
            </header>
            <section className="chat-interactions">
                {/* <article>
                    <div className="user-message">
                        A "text area" refers to a multi-line text input field commonly found in graphical user interfaces and web forms. It allows users to enter longer amounts of text, unlike single-line text input fields (often called "text boxes" or "input fields").
                        Key characteristics of a text area:
                        Multi-line input: The primary distinction is its ability to display and accept text across multiple lines, facilitating the input of paragraphs, comments, descriptions, or other extended content.
                    </div>
                </article>
                <article>
                    <div className="assistant-message">
                        <div className="markdown prose dark:prose-invert w-full break-words light markdown-new-styling">
                            <p data-start="0" data-end="185">Yes — your reasoning is <strong data-start="24" data-end="59">conceptually on the
                                right track</strong>. You’re essentially deriving the <strong data-start="93" data-end="125">gradient
                                    descent update rule</strong> for linear regression (with slope <code data-start="160"
                                        data-end="163">m</code> and intercept <code data-start="178" data-end="181">c</code>).</p>
                            <p data-start="187" data-end="278">Let’s go step by step through what’s written and how to move to the new values
                                correctly 👇</p>
                            <hr data-start="280" data-end="283"></hr>
                                <h3 data-start="285" data-end="305">🧩 What You Have</h3>
                                <p data-start="307" data-end="353">You start with the <strong data-start="326" data-end="351">estimated linear
                                    line</strong></p>
                        </div>
                    </div>
                </article>
                <article>
                    <div className="user-message">
                        A "text area" refers to a multi-line text input field commonly found in graphical user interfaces and web forms. It allows users to enter longer amounts of text, unlike single-line text input fields (often called "text boxes" or "input fields").
                        Key characteristics of a text area:
                        Multi-line input: The primary distinction is its ability to display and accept text across multiple lines, facilitating the input of paragraphs, comments, descriptions, or other extended content.
                    </div>
                </article>
                <article>
                    <div className="assistant-message">
                        <div className="markdown prose dark:prose-invert w-full break-words light markdown-new-styling">
                            <p data-start="0" data-end="185">Yes — your reasoning is <strong data-start="24" data-end="59">conceptually on the
                                right track</strong>. You’re essentially deriving the <strong data-start="93" data-end="125">gradient
                                    descent update rule</strong> for linear regression (with slope <code data-start="160"
                                        data-end="163">m</code> and intercept <code data-start="178" data-end="181">c</code>).</p>
                            <p data-start="187" data-end="278">Let’s go step by step through what’s written and how to move to the new values
                                correctly 👇</p>
                            <hr data-start="280" data-end="283"></hr>
                                <h3 data-start="285" data-end="305">🧩 What You Have</h3>
                                <p data-start="307" data-end="353">You start with the <strong data-start="326" data-end="351">estimated linear
                                    line</strong></p>
                        </div>
                    </div>
                </article> */}
                {messages.map((message, index) => (
                    <article key={index}>
                        <div className={message.role === 'user' ? 'whitespace-prewrap user-message' : 'whitespace-prewrap assistant-message'}>
                            {message.role === 'assistant' ? (
                                <div className="markdown prose dark:prose-invert w-full break-words light markdown-new-styling">
                                    {message.content}
                                </div>
                            ) : (
                                message.content
                            )}
                        </div>
                    </article>
                ))}
                {/* Add a <br/> after completion conversations */}
                {messages.length > 0 && messages[messages.length - 1].type === 'completions' && <br/>}
                {/* Show welcome message if no messages */}
            </section>
            <footer>
                <div className="chat-input">
                    <div contentEditable="true" className="input-area" placeholder="Ask your custom GPT" value={inputValue} onChange={(event) => {
                        // handleInputAreaHeight(event);
                        setInputValue(event.target.value);
                    }}></div>
                    <div className="feature-section">
                        <div className="left-section">
                                <button className="configure-target" onClick={handleOpenConfig} aria-haspopup="dialog">
                                    <span>Configure Target</span>
                                    <div className={`config-status ${isSaved ? 'saved' : ''}`}></div>
                                </button>
                            </div>
                        <div className="right-section">
                            <button className={`send-button ${isProcessing ? 'processing' : ''} `} type="sumbit" onClick={submitUserRequest}>
                                <svg className="send" display={`${isProcessing ? "none" : "block"}`} width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M8.99992 16V6.41407L5.70696 9.70704C5.31643 10.0976 4.68342 10.0976 4.29289 9.70704C3.90237 9.31652 3.90237 8.6835 4.29289 8.29298L9.29289 3.29298L9.36907 3.22462C9.76184 2.90427 10.3408 2.92686 10.707 3.29298L15.707 8.29298L15.7753 8.36915C16.0957 8.76192 16.0731 9.34092 15.707 9.70704C15.3408 10.0732 14.7618 10.0958 14.3691 9.7754L14.2929 9.70704L10.9999 6.41407V16C10.9999 16.5523 10.5522 17 9.99992 17C9.44764 17 8.99992 16.5523 8.99992 16Z"></path></svg>
                                <svg className="processing" display={`${isProcessing ? "block" : "none"}`} width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" fill="black"><path d="M4.5 5.75C4.5 5.05964 5.05964 4.5 5.75 4.5H14.25C14.9404 4.5 15.5 5.05964 15.5 5.75V14.25C15.5 14.9404 14.9404 15.5 14.25 15.5H5.75C5.05964 15.5 4.5 14.9404 4.5 14.25V5.75Z"></path></svg>
                            </button>
                        </div>
                    </div>

                </div>
            </footer>
            {configModalOpen && (
                <div style={{position:'fixed',inset:0,zIndex:9999,background: 'rgba(0,0,0,0.3)'}}>
                    <div className="configuration-modal">
                        <TargetConfiguration initialConfig={savedConfig} onSave={handleSaved} onClose={handleCloseConfig} />
                    </div>
                </div>
            )}
            {/* Toast notification */}
            <div className={`toast ${toastVisible ? 'show' : ''} ${!isSaved ? 'config-err' : ''}`} role="status" aria-live="polite">
                {toastMsg}
            </div>
        </div>
    );
}

export default ChatbotInteraction;