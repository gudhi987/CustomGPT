import "../styles/configuration.css";
import { useState, useCallback } from "react";
import { X, Plus, Trash2 } from "lucide-react";

function makeItem() {
    return { id: Date.now().toString(36) + Math.random().toString(36).slice(2), key: "", value: "" };
}

function TargetConfiguration() {
    const [headerConfig, setHeaderConfig] = useState([makeItem()]);
    const [queryConfig, setQueryConfig] = useState([makeItem()]);
    const [method, setMethod] = useState("GET");
    const [url, setUrl] = useState("");

    const addHeader = useCallback(() => {
        setHeaderConfig(prev => [...prev, makeItem()]);
    }, []);

    const addQuery = useCallback(() => {
        setQueryConfig(prev => [...prev, makeItem()]);
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
        const headers = headerConfig.reduce((acc,curr) => {
            const {key,value} = curr;
            acc[key]=value;
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
        console.log(base_url);
        console.log(base_url.href);
        const response = await fetch(base_url.href,{method, headers});
        console.log(response);
    }

    return (
        <div className="target-config" role="dialog" aria-label="Target configuration">
            <header className="tc-header">
                <h3>Configure HTTP target</h3>
                <button type="button">
                    <X size={20} />
                </button>
            </header>

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
                            placeholder="Value"
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
                <header><h4>Body</h4></header>
                <textarea rows="10" placeholder='Enter request body (JSON, text, XML, etc.)' />
            </div>

            <footer>
                <button type="button" className="test-config" onClick={testTarget}>Test Configuration</button>
            </footer>
        </div>
    );
}

export default TargetConfiguration;