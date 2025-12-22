import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { connectDB } from "./db.js";
import chatsRouter from "./routes/chats.js";

const app = express();

// Initialize database connection
connectDB().catch(err => {
	console.error("Failed to initialize database connection:", err.message);
	// App will continue running, routes will handle DB unavailability
});

// Middlewares
app.use(cors());
app.use(bodyParser.json({ limit: "2mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// API Routes
app.use("/api", chatsRouter);

// simple health route
app.get("/health", (_req, res) => {
	res.json({ ok: true, time: Date.now() });
});

/**
 * Proxy route — accepts a POST with a JSON payload describing the request to make.
 * Expected body shape (JSON):
 * {
 *   url: string,            // full url including query string (required)
 *   method?: string,        // GET|POST|PUT|DELETE... (defaults to GET)
 *   headers?: object,       // optional headers map
 *   body?: any,             // optional body (string or object)
 *   responseType?: string   // 'text' | 'json' | 'arrayBuffer' (defaults to 'text')
 * }
 *
 * The server will perform the request server-side (bypassing CORS) and return
 * a JSON envelope containing status, headers and body (as text or JSON when possible).
 */
app.post("/proxy", async (req, res) => {
	const { url, method = "GET", headers = {}, body: reqBody, responseType = "text" } = req.body || {};

	if (!url || typeof url !== "string") {
		return res.status(400).json({ error: "Missing or invalid `url` in request body" });
	}

	try {
		const fetchOptions = {
			method: method.toUpperCase(),
			headers: { ...headers },
		};

		// Attach body for non-GET/HEAD methods
		if (fetchOptions.method !== "GET" && fetchOptions.method !== "HEAD" && typeof reqBody !== "undefined") {
			// If body is an object and no content-type is provided, assume JSON
			const contentTypeKey = Object.keys(fetchOptions.headers).find(k => k.toLowerCase() === "content-type");
			if (!contentTypeKey && typeof reqBody === "object") {
				fetchOptions.headers["Content-Type"] = "application/json";
				fetchOptions.body = JSON.stringify(reqBody);
			} else if (typeof reqBody === "object" && fetchOptions.headers[contentTypeKey]) {
				// If content-type exists and is json-ish, stringify
				const ct = fetchOptions.headers[contentTypeKey];
				if (ct.includes("application/json")) fetchOptions.body = JSON.stringify(reqBody);
				else fetchOptions.body = reqBody;
			} else {
				fetchOptions.body = reqBody;
			}
		}

		// Use global fetch (Node 18+) or fallback to dynamic import of node-fetch if not available
		let nodeFetch = globalThis.fetch;
		if (typeof nodeFetch !== "function") {
			const mod = await import("node-fetch");
			nodeFetch = mod.default;
		}

		const proxied = await nodeFetch(url, fetchOptions);

		// collect headers
		const respHeaders = {};
		proxied.headers.forEach((v, k) => (respHeaders[k] = v));

		let payload;
		if (responseType === "json") {
			try {
				payload = await proxied.json();
			} catch (e) {
				payload = await proxied.text();
			}
		} else if (responseType === "arrayBuffer") {
			const buf = await proxied.arrayBuffer();
			payload = Buffer.from(buf).toString("base64");
		} else {
			payload = await proxied.text();
		}

		return res.json({
			ok: proxied.ok,
			status: proxied.status,
			statusText: proxied.statusText,
			headers: respHeaders,
			body: payload,
		});
	} catch (err) {
		console.error("/proxy error:", err && err.stack ? err.stack : err);
		return res.status(502).json({ error: String(err) });
	}
});

// start server when run directly
if (process.env.NODE_ENV !== "test") {
	const port = process.env.PORT || 3000;
	app.listen(port, () => console.log(`Dev proxy server listening on http://localhost:${port}`));
}

export default app;