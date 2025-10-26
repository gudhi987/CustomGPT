import "../styles/interaction.css";
import { useState, useEffect, useRef } from "react";
import TargetConfiguration from "./configuration";

function ChatbotInteraction() {
    const [configModalOpen, setConfigModalOpen] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [savedConfig, setSavedConfig] = useState(null);

    // Do not read or write localStorage/server for sensitive configs. Keep in-memory only.
    useEffect(() => {
        // Nothing to load initially; savedConfig remains null until user saves in this session.
    }, []);

    function handleInputAreaHeight(event) {
        const value = event.target.value;
        let max_rows = 8;
        let count = 0;
        for (let i = 0; i < value.length; i++) {
            if (value[i] === "\n") {
                count++;
            }
        }
        event.target.rows = Math.min(count + 1, max_rows);
    }

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

    // Toast state and helpers
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

    return (
        <div className="chat-interface">
            <header>
                <p>CustomGPT</p>
            </header>
            <section className="chat-interactions">
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
                </article>
            </section>
            <footer>
                <div className="chat-input">
                    <textarea className="input-area" placeholder="Ask your custom GPT" rows="1" cols="1" onChange={handleInputAreaHeight}></textarea>
                    <div className="feature-section">
                        <div className="left-section">
                                <button className="configure-target" onClick={handleOpenConfig} aria-haspopup="dialog">
                                    <span>Configure Target</span>
                                    <div className={`config-status ${isSaved ? 'saved' : ''}`}></div>
                                </button>
                            </div>
                        <div className="right-section">
                            <button className="send-button" type="sumbit">
                                <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M8.99992 16V6.41407L5.70696 9.70704C5.31643 10.0976 4.68342 10.0976 4.29289 9.70704C3.90237 9.31652 3.90237 8.6835 4.29289 8.29298L9.29289 3.29298L9.36907 3.22462C9.76184 2.90427 10.3408 2.92686 10.707 3.29298L15.707 8.29298L15.7753 8.36915C16.0957 8.76192 16.0731 9.34092 15.707 9.70704C15.3408 10.0732 14.7618 10.0958 14.3691 9.7754L14.2929 9.70704L10.9999 6.41407V16C10.9999 16.5523 10.5522 17 9.99992 17C9.44764 17 8.99992 16.5523 8.99992 16Z"></path></svg>
                            </button>
                        </div>
                    </div>

                </div>
            </footer>
            {configModalOpen && (
                <div style={{position:'fixed',inset:0,display:'grid',placeItems:'center',zIndex:9999,background: 'rgba(0,0,0,0.3)'}}>
                    <div style={{maxHeight:'90vh', overflow:'auto', background:'white', padding:12}}>
                        <TargetConfiguration initialConfig={savedConfig} onSave={handleSaved} onClose={handleCloseConfig} />
                    </div>
                </div>
            )}
            {/* Toast notification */}
            <div className={`toast ${toastVisible ? 'show' : ''}`} role="status" aria-live="polite">
                {toastMsg}
            </div>
        </div>
    );
}

export default ChatbotInteraction;