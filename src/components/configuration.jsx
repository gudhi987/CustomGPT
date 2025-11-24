import "../styles/configuration.css";
import { useState, useCallback, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";

function makeItem() {
    return { id: Date.now().toString(36) + Math.random().toString(36).slice(2), key: "", value: "" };
}

function TargetConfiguration({ onSave, onClose, initialConfig = null }) {
    const [headerConfig, setHeaderConfig] = useState([makeItem()]);
    const [queryConfig, setQueryConfig] = useState([makeItem()]);
    const [method, setMethod] = useState("GET");
    const [url, setUrl] = useState("");
    const [bodyContent, setBodyContent] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [modelType, setModelType] = useState("completions"); // 'completions' or 'chat'
    const [outputType, setOutputType] = useState("json"); // 'text' | 'json' | 'arrayBuffer'
    const [responsePath, setResponsePath] = useState("response.choices[0].text");
    const [localSaved, setLocalSaved] = useState(false);

    // Populate fields from an initial in-memory configuration when provided by the parent.
    useEffect(() => {
        if (!initialConfig) return;
        try {
            const saved = initialConfig;
            if (saved.url) setUrl(saved.url);
            if (saved.method) setMethod(saved.method);
            if (saved.bodyContent) setBodyContent(saved.bodyContent);
            if (saved.headerConfig) setHeaderConfig(saved.headerConfig);
            if (saved.queryConfig) setQueryConfig(saved.queryConfig);
            if (saved.modelType) setModelType(saved.modelType);
            if (saved.outputType) setOutputType(saved.outputType);
            if (saved.responsePath) setResponsePath(saved.responsePath);
            if (saved._savedAt) setLocalSaved(true);
        } catch (e) {
            // ignore
        }
    }, [initialConfig]);

    const addHeader = useCallback(() => {
        setHeaderConfig(prev => [...prev, makeItem()]);
    }, []);

    const addQuery = useCallback(() => {
        const newItem = makeItem();
        newItem.key = "prompt"; // Default key for prompt
        newItem.value = "{{prompt}}"; // Default placeholder
        setQueryConfig(prev => [...prev, newItem]);
    }, []);

    const updateHeader = useCallback((id, field, value) => {
        setHeaderConfig(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
    }, []);

    const deleteHeader = useCallback((id) => {
        setHeaderConfig(prev => prev.filter(it => it.id !== id));
    }, []);

    const updateQuery = useCallback((id, field, value) => {
        setQueryConfig(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it));
    }, []);

    const deleteQuery = useCallback((id) => {
        setQueryConfig(prev => prev.filter(it => it.id !== id));
    }, []);

    const testTarget = async () => {
        // Validate required fields
        if (!url) {
            setTestResult({ error: "URL is required" });
            return;
        }

        // Validate {{prompt}} placeholder presence
        const promptInQueries = queryConfig.some(q => q.value && q.value.includes("{{prompt}}"));
        const promptInBody = bodyContent && bodyContent.includes("{{prompt}}");
        
        if (!promptInQueries && !promptInBody) {
            setTestResult({ 
                error: "The placeholder {{prompt}} must be present in either query parameters or body content to indicate where user input should be inserted. Add it to either:\n" +
                      "- Query parameter value: {{prompt}}\n" +
                      "- Body content: directly as {{prompt}} for text, or {\"prompt\": \"{{prompt}}\"} for JSON"
            });
            return;
        }
        
        if (promptInQueries && promptInBody) {
            setTestResult({ 
                error: "The placeholder {{prompt}} should only appear once, either in query parameters or body content, not both. Please remove it from one location."
            });
            return;
        }

        try {
            new URL(url); // validate URL format
        } catch (e) {
            setTestResult({ error: "Invalid URL format" });
            return;
        }

        // For POST/PUT with JSON content type, validate JSON
        const contentTypeHeader = headerConfig.find(h => h.key.toLowerCase() === 'content-type');
        if (method !== 'GET' && contentTypeHeader?.value?.includes('application/json') && bodyContent) {
            try {
                JSON.parse(bodyContent);
            } catch (e) {
                setTestResult({ error: "Invalid JSON in request body" });
                return;
            }
        }

        if(!responsePath) {
            setTestResult({ error: "Response mapping expression is required to extract the desired value from the response." });
            return;
        }
        if(outputType === "text" && responsePath !== "response") {
            setTestResult({ error: "When output type is 'text', the response mapping must be 'response' to access the raw text." });
            return;
        }

    setIsLoading(true);
    setTestResult(null);

        const headers = headerConfig.reduce((acc,curr) => {
            const {key,value} = curr;
            if (key) acc[key]=value;
            return acc;
        },{});

        const base_url=new URL(url);
        queryConfig.forEach((val,idx) => {
            const {key,value} = val;
            if(key && value)
            {
                base_url.searchParams.append(key,value);
            }
        });

        // Build body to send to proxy. If content-type is JSON, try to parse so server will stringify.
        let bodyToSend = bodyContent;
        const contentTypeKey = Object.keys(headers).find(k => k.toLowerCase() === 'content-type');
        const contentType = contentTypeKey ? headers[contentTypeKey] : '';
        if (method !== 'GET' && method !== 'HEAD' && bodyContent && bodyContent.length > 0) {
            if (!contentTypeKey) {
                const trimmed = bodyContent.trim();
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    headers['Content-Type'] = 'application/json';
                    try {
                        bodyToSend = JSON.parse(bodyContent);
                    } catch {
                        bodyToSend = bodyContent;
                    }
                }
            } else if (contentType.includes('application/json')) {
                try { bodyToSend = JSON.parse(bodyContent); } catch { bodyToSend = bodyContent; }
            }
        }

        // Send request via dev-server proxy to bypass CORS
        try {
            const proxyReq = {
                url: base_url.href,
                method,
                headers,
                body: bodyToSend,
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
                try { bodyObj = JSON.parse(bodyObj); } catch { /* leave as string */ }
            }

            const getByPath = (obj, expr) => {
                if (!expr) return obj;
                try {
                    const fn = new Function('response', `return (${expr});`);
                    return fn(obj);
                } catch (e) {
                    return undefined;
                }
            };

            let extracted;
            try {
                extracted = getByPath(bodyObj, responsePath);
            } catch (e) { extracted = undefined; }

            setTestResult({
                ok: envelope.ok,
                status: envelope.status,
                statusText: envelope.statusText,
                envelope,
                extracted
            });
        } catch (err) {
            setTestResult({ error: err.message });
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="target-config" role="dialog" aria-label="Target configuration">
            <header className="tc-header">
                <h3>Configure HTTP target</h3>
                <button type="button" onClick={() => onClose && onClose()} aria-label="Close configuration">
                    <X size={20} />
                </button>
            </header>

            {localSaved && (
                <div className="saved-banner">Configuration saved (in-memory for this session)</div>
            )}

            <div className="base-config">
                <div className="method-config">
                    <h4>Method</h4>
                    <select value={method} onChange={(e) => setMethod(e.target.value)}>
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                    </select>
                </div>
                <div className="url-config">
                    <h4>URL</h4>
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://api.example.com/endpoint"
                    />
                </div>
            </div>

            <div className="header-config">
                <header>
                    <h4>Headers</h4>
                    <button type="button" onClick={addHeader}>
                        <Plus size={16} /> <span>Add Header</span>
                    </button>
                </header>

                {headerConfig.map(({ id, key, value }) => (
                    <div className="header-content" key={id}>
                        <input
                            placeholder="Key"
                            value={key}
                            onChange={(e) => updateHeader(id, "key", e.target.value)}
                        />
                        <input
                            placeholder="Value"
                            value={value}
                            onChange={(e) => updateHeader(id, "value", e.target.value)}
                        />
                        <button type="button" onClick={() => deleteHeader(id)} aria-label="Remove header">
                            <Trash2 size={20} stroke="red" />
                        </button>
                    </div>
                ))}
            </div>

            <div className="query-config">
                <header>
                    <h4>Query Parameters</h4>
                    <button type="button" onClick={addQuery}>
                        <Plus size={16} /> <span>Add Parameter</span>
                    </button>
                </header>

                {queryConfig.map(({ id, key, value }) => (
                    <div className="query-content" key={id}>
                        <input
                            placeholder="Key"
                            value={key}
                            onChange={(e) => updateQuery(id, "key", e.target.value)}
                        />
                        <input
                            placeholder="Use {{prompt}} to indicate where user input should be inserted"
                            value={value}
                            onChange={(e) => updateQuery(id, "value", e.target.value)}
                        />
                        <button type="button" onClick={() => deleteQuery(id)} aria-label="Remove parameter">
                            <Trash2 size={20} stroke="red" />
                        </button>
                    </div>
                ))}
            </div>

            <div className="body-config">
                <header>
                    <h4>Body</h4>
                    {method !== 'GET' && (
                        <button
                            type="button"
                            onClick={() => {
                                const contentTypeHeader = headerConfig.find(h => h.key.toLowerCase() === 'content-type');
                                const isJson = contentTypeHeader?.value?.includes('application/json');
                                const defaultContent = isJson ? 
                                    JSON.stringify({ prompt: "{{prompt}}" }, null, 2) : 
                                    "{{prompt}}";
                                setBodyContent(defaultContent);
                            }}
                        >
                            <Plus size={16} /> <span>Add Prompt Template</span>
                        </button>
                    )}
                </header>
                <textarea 
                    rows="10" 
                    placeholder='Enter request body (JSON, text, XML, etc.). Use {{prompt}} to indicate where user input should be inserted.'
                    value={bodyContent} 
                    onChange={(e) => setBodyContent(e.target.value)} 
                />
            </div>

            <div className="model-config" style={{marginTop: '0.5rem'}}>
                <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <label style={{display:'block', fontSize:'.85rem', marginRight:6}}>Model</label>
                    <label style={{display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer'}}>
                        <input type="checkbox" checked={modelType === 'chat'} onChange={(e)=> setModelType(e.target.checked ? 'chat' : 'completions')} />
                        <span style={{fontSize:'.85rem'}}>{modelType === 'chat' ? 'Chat' : 'Completions'}</span>
                    </label>
                </div>

                <div>
                    <label style={{display:'block', fontSize:'.85rem', marginTop: '0.5rem'}}>Output</label>
                    <select value={outputType} onChange={(e) => setOutputType(e.target.value)}>
                        <option value="text">text</option>
                        <option value="json">json</option>
                        <option value="arrayBuffer">arrayBuffer</option>
                    </select>
                </div>

                <div style={{flex:1}}>
                    <label style={{display:'block', fontSize:'.85rem'}}>Response mapping
                        <button type="button" title={`This expression will be executed against the returned response to extract the useful value. Examples (use exactly as shown):\n- Completions: response["response"][0]["text"]\n- Chat: response["response"][0]["generated_text"].at(-1)["content"]`} style={{marginLeft:6}}>ℹ️</button>
                    </label>
                    <input placeholder={modelType === 'chat' ? 'response["response"][0]["generated_text"].at(-1)["content"]' : 'response["response"][0]["text"]'} value={responsePath} onChange={(e)=>setResponsePath(e.target.value)} />
                </div>
            </div>

            {testResult && (
                <div className={`response-display ${testResult.ok ? 'success' : 'error'}`}>
                    <div className="response-header">
                        {testResult.error ? (
                            <h4>Error</h4>
                        ) : (
                            <h4>Response: {testResult.status} {testResult.statusText}</h4>
                        )}
                    </div>
                    <div style={{padding: '0.5rem 1rem'}}>
                        <strong>Extracted:</strong>
                        <pre className="response-body" style={{marginTop:6}}>{testResult.error ? testResult.error : (typeof testResult.extracted === 'undefined' ? '— no value at the configured mapping —' : (typeof testResult.extracted === 'object' ? JSON.stringify(testResult.extracted, null, 2) : String(testResult.extracted)))}</pre>
                        <details style={{marginTop:8}}>
                            <summary style={{cursor:'pointer'}}>Full envelope</summary>
                            <pre className="response-body" style={{marginTop:6}}>{JSON.stringify(testResult.envelope ?? testResult, null, 2)}</pre>
                        </details>
                    </div>
                </div>
            )}

            <footer>
                <div style={{display:'flex', gap: '0.5rem', justifyContent:'flex-end', alignItems:'center'}}>
                    {/* Show Save button only after a successful test */}
                    {testResult && testResult.ok && (
                        <button
                            type="button"
                            className="save-config"
                            onClick={() => {
                                const cfg = {
                                    method,
                                    url,
                                    headerConfig,
                                    queryConfig,
                                    bodyContent,
                                    modelType,
                                    outputType,
                                    responsePath,
                                    _savedAt: Date.now()
                                };
                                try {
                                    setLocalSaved(true);
                                    if (onSave) onSave(cfg);
                                } catch (e) {
                                    console.error('Failed to notify parent of saved config', e);
                                }
                            }}
                        >
                            Save Configuration
                        </button>
                    )}

                    <button 
                        type="button" 
                        className={`test-config ${isLoading ? 'loading' : ''}`} 
                        onClick={testTarget}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Testing...' : 'Test Configuration'}
                    </button>

                    <button type="button" className="cancel-config" onClick={() => onClose && onClose()}>
                        Close
                    </button>
                </div>
            </footer>
        </div>
    );
}

export default TargetConfiguration;
