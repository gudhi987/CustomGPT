import "../styles/interaction.css";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import TargetConfiguration from "./configuration.jsx";

function ChatbotInteraction() {
    const navigate = useNavigate();
    const { chatId } = useParams();
    const [configModalOpen, setConfigModalOpen] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [savedConfig, setSavedConfig] = useState(null);
    // Track all user/assistant messages with type (completion/chat)
    const [messages, setMessages] = useState([]);
    // Track current input
    const [inputValue, setInputValue] = useState("");
    const [currentChatId, setCurrentChatId] = useState(chatId || null);
    const [hasSubmittedFirst, setHasSubmittedFirst] = useState(!!chatId);
    const [chatLoadError, setChatLoadError] = useState(false);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const newChatIdRef = useRef(null);

    // Load chat history when chatId changes
    useEffect(() => {
        if (chatId) {
            // Skip loading if this is a newly created chat
            if (newChatIdRef.current === chatId) {
                newChatIdRef.current = null;
                setIsLoadingMessages(false);
                return;
            }
            setIsLoadingMessages(true);
            const loadChatHistory = async () => {
                // Clear messages at the very start of loading
                setMessages([]);
                try {
                    console.log('Fetching chat history for:', chatId);
                    const res = await fetch(`http://localhost:3000/api/chats/${chatId}`);
                    const data = await res.json();
                    
                    console.log('Chat data received:', data);
                    
                    if (data.ok && data.chat) {
                        // Chat found, clear any previous errors
                        setChatLoadError(false);
                        
                        // Load messages from database if they exist
                        if (data.chat.messages && data.chat.messages.length > 0) {
                            console.log('Messages found:', data.chat.messages.length);
                            
                            // Build hierarchical message order based on parent_id
                            const messageMap = {};
                            const rootMessages = [];
                            
                            data.chat.messages.forEach(msg => {
                                messageMap[msg.message_id] = msg;
                            });
                            
                            data.chat.messages.forEach(msg => {
                                if (msg.parent_id === 'root' || msg.parent_id === '' || !messageMap[msg.parent_id]) {
                                    rootMessages.push(msg.message_id);
                                }
                            });
                            
                            // Build ordered message list, excluding system message from display
                            const orderedMessages = [];
                            const visited = new Set();
                            
                            const buildHierarchy = (messageId) => {
                                if (visited.has(messageId) || !messageMap[messageId]) return;
                                visited.add(messageId);
                                
                                const msg = messageMap[messageId];
                                
                                // Skip system message but continue building hierarchy
                                if (msg.role !== 'system') {
                                    orderedMessages.push({
                                        role: msg.role || (msg.interaction_type === 'chat' ? 'user' : 'assistant'),
                                        content: msg.message_content,
                                        type: msg.interaction_type,
                                        message_id: msg.message_id,
                                        parent_id: msg.parent_id
                                    });
                                }
                                
                                // Find children and add them
                                data.chat.messages.forEach(m => {
                                    if (m.parent_id === messageId) {
                                        buildHierarchy(m.message_id);
                                    }
                                });
                            };
                            
                            rootMessages.forEach(msgId => buildHierarchy(msgId));
                            
                            console.log('Converted messages:', orderedMessages);
                            setMessages(orderedMessages);
                        } else {
                            console.log('No messages in chat');
                            setMessages([]);
                        }
                        setIsLoadingMessages(false);
                    } else {
                        console.error('Failed to fetch chat:', data.message || 'Chat not found');
                        setChatLoadError(true);
                        setIsLoadingMessages(false);
                        // Redirect to home page after a short delay to allow error message to display
                        setTimeout(() => {
                            navigate('/');
                        }, 1500);
                    }
                } catch (err) {
                    console.error('Error loading chat history:', err);
                    setChatLoadError(true);
                    setIsLoadingMessages(false);
                    // Redirect to home page after a short delay
                    setTimeout(() => {
                        navigate('/');
                    }, 1500);
                }
            };
            loadChatHistory();
        }
    }, [chatId, navigate]);

    // Clear messages when returning to home (no chatId)
    useEffect(() => {
        if (!chatId) {
            setMessages([]);
            setChatLoadError(false);
            setCurrentChatId(null);
            setHasSubmittedFirst(false);
        }
    }, [chatId]);

    const inputRef = useRef(null);
    const sectionRef = useRef(null);
    const buttonRef = useRef(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const lastCallRef = useRef(0);
    const maximumScrollValueRef = useRef(0);

    // Initialize scroll position and calculate maximum scroll value
    useEffect(() => {
        const updateMaximumScrollValue = () => {
            if (sectionRef.current) {
                const totalParentContentHeight = sectionRef.current.clientHeight;
                const totalContentHeight = sectionRef.current.scrollHeight;
                const maximumScrollValue = Math.max(0, totalContentHeight - totalParentContentHeight);
                maximumScrollValueRef.current = maximumScrollValue;
            }
        };
        
        updateMaximumScrollValue();
        window.addEventListener('resize', updateMaximumScrollValue);
        return () => window.removeEventListener('resize', updateMaximumScrollValue);
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
            if (!prompt) {
                showToast('User input cannot be empty');
                return ;
            }

            const modelType = savedConfig?.modelType || 'completions';
            
            // Generate a unique message_id for the user message
            const userMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            setMessages(prev => [
                ...prev,
                { role: 'user', content: prompt, type: modelType, message_id: userMessageId, parent_id: prev.length > 0 ? prev[prev.length - 1].message_id || 'root' : 'root' }
            ]);
            setInputValue("");
            inputRef.current.textContent = "";

            // Create chat if on first submission and DB is healthy
            let activeChatId = currentChatId;
            if (!currentChatId && !hasSubmittedFirst) {
                try {
                    const healthRes = await fetch('http://localhost:3000/api/dbhealth');
                    const healthData = await healthRes.json();
                    
                    if (healthData.ok) {
                        const createRes = await fetch('http://localhost:3000/api/chats', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_name: prompt.slice(0, 50) + (prompt.length > 50 ? '...' : '')
                            })
                        });
                        const createData = await createRes.json();
                        if (createData.ok) {
                            activeChatId = createData.chat_id;
                            newChatIdRef.current = activeChatId;
                            setCurrentChatId(activeChatId);
                            setHasSubmittedFirst(true);
                            // Navigate to the new chat and emit event with new chat data for sidebar
                            navigate(`/chat/${activeChatId}`);
                            window.dispatchEvent(new CustomEvent('newChatCreated', {
                                detail: {
                                    chat_id: createData.chat_id,
                                    chat_name: createData.chat_name || prompt.slice(0, 50) + (prompt.length > 50 ? '...' : '')
                                }
                            }));
                        }
                    } else {
                        setHasSubmittedFirst(true);
                    }
                } catch (err) {
                    console.error('Error creating chat:', err);
                    setHasSubmittedFirst(true);
                }
            }
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
            queryParams.forEach(q => {
                let queryValue = q.value;
                if (queryValue.includes("{{prompt}}")) {
                    queryValue = encodeURIComponent(prompt);
                }
                baseUrl.searchParams.append(q.key, queryValue);
            });

            if (modelType === 'chat') {
                let chatHistory = [];
                for (let i = messages.length - 1; i >= 0; i--) {
                    if (messages[i].type === 'completion') break;
                    chatHistory.unshift(messages[i]);
                }
                chatHistory.push({ role: 'user', content: prompt, type: 'chat' });
                requestBody = { messages: chatHistory.map(({ role, content }) => ({ role, content })) };
            } else {
                requestBody = { prompt };
            }

            if (savedConfig?.bodyContent) {
                try {
                    if (savedConfig.bodyContent.includes("{{prompt}}")) {
                        if (savedConfig.bodyContent.trim().startsWith("{")) {
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
                            requestBody = prompt;
                        }
                    } else {
                        let bodyObj = JSON.parse(savedConfig.bodyContent);
                        if (modelType === 'chat') bodyObj.messages = requestBody.messages;
                        else bodyObj.prompt = prompt;
                        requestBody = bodyObj;
                    }
                } catch {
                    requestBody = prompt;
                }
            }

            setIsProcessing(true);
            setMessages(prev => [
                    ...prev,
                    { role: 'processing', content: '', type: '' }
                ]);

            try {
                // Determine parent_id for the user message (parent to the previous message in the thread)
                let lastMessageId = 'root';
                let userMessageParentId = 'root';
                
                // If there are messages, use the last one as parent
                if (messages.length > 0) {
                    userMessageParentId = messages[messages.length - 1].message_id || 'root';
                }
                
                // Append user message to chat if chat exists
                if (activeChatId) {
                    try {
                        const userMsgRes = await fetch(`http://localhost:3000/api/chats/${activeChatId}/messages`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                role: 'user',
                                interaction_type: modelType === 'chat' ? 'chat' : 'completion',
                                message_content: prompt,
                                parent_id: userMessageParentId
                            })
                        });
                        const userMsgData = await userMsgRes.json();
                        if (userMsgData.ok) {
                            lastMessageId = userMsgData.message_id;
                            // If this was a new chat (just created), emit update and navigate
                            if (!currentChatId && hasSubmittedFirst) {
                                window.dispatchEvent(new Event('chatUpdated'));
                                navigate(`/chat/${activeChatId}`);
                            }
                        }
                    } catch (err) {
                        console.error('Error appending user message to chat:', err);
                    }
                }
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
                let extracted;
                try {
                    const fn = new Function('response', `return (${responsePath});`);
                    extracted = fn(bodyObj);
                } catch {
                    extracted = undefined;
                }
                
                const assistantContent = typeof extracted === 'undefined' ? '(no response)' : (typeof extracted === 'object' ? JSON.stringify(extracted, null, 2) : String(extracted));
                
                // Generate a unique message_id for the assistant message
                const assistantMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                
                // Append assistant message to chat if chat exists
                if (activeChatId) {
                    try {
                        await fetch(`http://localhost:3000/api/chats/${activeChatId}/messages`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                role: 'assistant',
                                interaction_type: modelType === 'chat' ? 'chat' : 'completion',
                                message_content: assistantContent,
                                parent_id: lastMessageId
                            })
                        });
                    } catch (err) {
                        console.error('Error appending assistant message to chat:', err);
                    }
                }
                
                setMessages(prev => [
                    ...prev.filter(m => m.role !== 'processing'),
                    { role: 'assistant', content: assistantContent, type: modelType, message_id: assistantMessageId, parent_id: lastMessageId }
                ]);
            } catch (err) {
                setMessages(prev => [
                    ...prev.filter(m => m.role !== 'processing'),
                    { role: 'assistant', content: 'Error: ' + (err?.message || err), type: modelType }
                ]);
            }

            setIsProcessing(false);
    }

    return (
        <div className="chat-interface">
            <header>
                <p>CustomGPT</p>
            </header>
            {chatLoadError ? (
                <section className="chat-interactions" ref={sectionRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                    <div style={{ textAlign: 'center', color: '#ef4444', fontSize: '1.1rem' }}>
                        <p>❌ Chat not found</p>
                        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Redirecting to home...</p>
                    </div>
                </section>
            ) : (
                <section className="chat-interactions" ref={sectionRef} onScroll={handleOnScroll}>
                {isLoadingMessages && messages.length === 0 ? (
                    <div className="messages-shimmer-container">
                        <div className="rotating-shimmer"></div>
                    </div>
                ) : (
                    <>
                        {messages.map((message, index) => (
                            <article key={index}>
                                <div className={message.role === 'user' ? 'whitespace-prewrap user-message' : 'whitespace-prewrap assistant-message'}>
                                    {message.role === 'processing' ? (<div className="assistant-processing-shimmer"></div>) : (
                                       message.role === "assistant" ? (
                                        <div className="markdown prose dark:prose-invert w-full break-words light markdown-new-styling">
                                            <Markdown>{message.content}</Markdown>
                                        </div>
                                    ) : (message.content)
                                    )}
                                </div>
                            </article>
                        ))}
                        {messages.length > 0 && messages[messages.length - 1].type === 'completions' && <br/>}
                    </>
                )}
                <button className="scroll-to-bottom" ref={buttonRef} onClick={(event) => {
                    if (sectionRef.current) {
                        sectionRef.current.scrollTop = maximumScrollValueRef.current;
                    }
                }}>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="white" xmlns="http://www.w3.org/2000/svg" className="icon text-token-text-primary"><path d="M9.33468 3.33333C9.33468 2.96617 9.6326 2.66847 9.99972 2.66829C10.367 2.66829 10.6648 2.96606 10.6648 3.33333V15.0609L15.363 10.3626L15.4675 10.2777C15.7255 10.1074 16.0762 10.1357 16.3034 10.3626C16.5631 10.6223 16.5631 11.0443 16.3034 11.304L10.4704 17.137C10.2108 17.3967 9.7897 17.3966 9.52999 17.137L3.69601 11.304L3.61105 11.1995C3.44054 10.9414 3.46874 10.5899 3.69601 10.3626C3.92328 10.1354 4.27479 10.1072 4.53292 10.2777L4.63741 10.3626L9.33468 15.0599V3.33333Z"></path></svg>
                </button>
            </section>
            )}
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
                        
                        const text = event.clipboardData.getData('text/plain');
                        document.execCommand('insertText', false, text);
                    }}
                    onKeyDown={(event) => {
                        if(!event.shiftKey && event.key==="Enter") submitUserRequest(event);
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
            <div className={`toast ${toastVisible ? 'show' : ''} ${!isSaved ? 'config-err' : ''}`} role="status" aria-live="polite">
                {toastMsg}
            </div>
        </div>
    );
}

export default ChatbotInteraction;
