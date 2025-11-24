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
    const inputRef = useRef(null);
    const sectionRef = useRef(null);
    const buttonRef = useRef(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const lastCallRef = useRef(0);
    const maximumScrollValueRef = useRef(0);

    // Initialize scroll position and calculate maximum scroll value
    useEffect(() => {
        if (sectionRef.current) {
            const totalParentContentHeight = sectionRef.current.clientHeight;
            const totalContentHeight = sectionRef.current.scrollHeight;
            const maximumScrollValue = Math.max(0, totalContentHeight - totalParentContentHeight);
            maximumScrollValueRef.current = maximumScrollValue;
        }
    }, [messages]);

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

    const handleOnScroll = (event) => {
        let now = Date.now();
        if (now - lastCallRef.current < 100) return;
        lastCallRef.current = now;
        const currScrollPosition = event.target.scrollTop;
        // console.log(currScrollPosition);
        if (maximumScrollValueRef.current - currScrollPosition >= 100) {
            if (buttonRef.current) {
                buttonRef.current.style.display = "grid";
            }
        } else {
            if (buttonRef.current) {
                buttonRef.current.style.display = "none";
            }
        }
    }

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
            inputRef.current.textContent = "";
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
                let queryValue = q.value;
                if (queryValue.includes("{{prompt}}")) {
                    queryValue = encodeURIComponent(prompt);
                }
                baseUrl.searchParams.append(q.key, queryValue);
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
                                        if(obj[key].includes("{{prompt}}")) {
                                            obj[key] = prompt;
                                        }
                                    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                                        replacePromptInObject(obj[key]);
                                    }
                                });
                            };
                            replacePromptInObject(bodyTemplate);
                            requestBody = bodyTemplate;
                        } else {
                            // For plain text body, simple replacement
                            requestBody = prompt;
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
                    requestBody = prompt;
                }
            }

            // Indicate processing state
            setIsProcessing(true);
            setMessages(prev => [
                    ...prev,
                    { role: 'processing', content: '', type: '' }
                ]);

            // Send request via proxy
            try {
                const proxyReq = {
                    url: baseUrl.href,
                    method,
                    headers,
                    body: requestBody,
                    responseType: outputType
                };
                console.log("Proxy request:", proxyReq);
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
                    ...prev.filter(m => m.role !== 'processing'),
                    { role: 'assistant', content: typeof extracted === 'undefined' ? '(no response)' : (typeof extracted === 'object' ? JSON.stringify(extracted, null, 2) : String(extracted)), type: modelType }
                ]);
            } catch (err) {
                setMessages(prev => [
                    ...prev.filter(m => m.role !== 'processing'),
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
            <section className="chat-interactions" ref={sectionRef} onScroll={handleOnScroll}>
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
                            {message.role === 'processing' ? (<div className="assistant-processing-shimmer"></div>) : (
                               message.role === "assistant" ? (
                                <div className="markdown prose dark:prose-invert w-full break-words light markdown-new-styling">
                                    {message.content}
                                </div>
                            ) : (message.content)
                            )}
                        </div>
                    </article>
                ))}
                {/* Add a <br/> after completion conversations */}
                {messages.length > 0 && messages[messages.length - 1].type === 'completions' && <br/>}
                {/* Show welcome message if no messages */}

                {/* ScrollToBottom button that pop up when the scroll bar is about a certain height.  */}
                <button className="scroll-to-bottom" ref={buttonRef} onClick={(event) => {
                    if (sectionRef.current) {
                        sectionRef.current.scrollTop = maximumScrollValueRef.current;
                    }
                }}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="white" xmlns="http://www.w3.org/2000/svg" className="icon text-token-text-primary"><path d="M9.33468 3.33333C9.33468 2.96617 9.6326 2.66847 9.99972 2.66829C10.367 2.66829 10.6648 2.96606 10.6648 3.33333V15.0609L15.363 10.3626L15.4675 10.2777C15.7255 10.1074 16.0762 10.1357 16.3034 10.3626C16.5631 10.6223 16.5631 11.0443 16.3034 11.304L10.4704 17.137C10.2108 17.3967 9.7897 17.3966 9.52999 17.137L3.69601 11.304L3.61105 11.1995C3.44054 10.9414 3.46874 10.5899 3.69601 10.3626C3.92328 10.1354 4.27479 10.1072 4.53292 10.2777L4.63741 10.3626L9.33468 15.0599V3.33333Z"></path></svg>
                </button>
            </section>
            <footer>
                <div className="chat-input">
                    <span contentEditable="true" className="input-area" placeholder="Ask your custom GPT" ref={inputRef}
                    onInput={ 
                        (event) => {
                            if(!event.target.textContent) {
                                event.target.innerHTML = "";
                                setInputValue("");
                                return;
                            }
                            setInputValue(event.target.innerText);
                        }
                    }
                    onPaste={(event) => {
                        event.preventDefault();
                        const clipBoardItem = navigator.clipboard.read();
                        clipBoardItem.then((data) => {
                            const plainText = data[0].getType("text/plain");
                            plainText.then((data) => data.text()).then((text) => {
                                setInputValue((prev) => prev + text);
                                inputRef.current.innerText += text;
                            });
                        })
                        .catch((err) => {
                            console.error('Failed to read clipboard contents: ', err);
                        })
                    }}></span>
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