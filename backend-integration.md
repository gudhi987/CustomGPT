Current capability of customGPT,
- You can configure your http target (completions/chat) (chat requires further testing) and be able to test and interact with the model
- The UI sidebar contains the list of previous chats (dummy as of now as there is no backend integration) and an interactive interaction space to view the interactions.
- The basic version of UI is good and now we want to have a backend connection so that we can fetch all these details from the backend mongodb database.

Backend integration implementation details:
- Build a route to check the connection to the database exists (Database is up), 
    1. The route name can be /dbhealth
    2. It should ping the mongodb at port 27017 and check the health.
    3. This check we do while we try to get/update any information from database.
    4. While fetching something if the remote health does not return 200, then it fails. Similarly if we loose connection in between a conversation while inserting a message we do not storge them in db but we can display in the UI.
    5. Whenever it fails we should not make the system break, instead we need to make changes to the ui without the db updates as a compromise.
- We can use the database named **customgpt**. It will contain a collection named chats/history which should contain information regarding a complete chat.
    - The schema for the collection should be like
    ```json
    {
        chat_id,
        chat_name,
        created_at,
        last_updated_at,
        config_name,
        messages: [{
            message_id,
            interaction_type ("chat" | "completion"),
            created_at,
            message_content,
            parent_id ("root" | previous_message_id),
            status ("success" | "failure" | "interrupted")
        }]
    }
    ```
    - From this collection we can det the chat names from history for the sidebar.
    - Default we will be on a new chat localhost:5173/, whenever we have a successful health check and when the user asks the first question we should route to localhost:5173/chat/:chat_id and append the first message to the db and simultaneously start processing the request. If the health check is false then we can start the interaction in the same page without the dependency of the database.
    - If user clicks on the already available chats, then we first need to render the available messages for that chat and then we should allow the user to enter the message (only when the health check is successful)



Step-by-step implementation (minimal, actionable)
1. Add a db module (e.g., backend/src/db.js):
   - Read MONGO_URI from env (default mongodb://localhost:27017/customgpt).
   - Connect once at startup; expose a ping/health function that uses db.admin().ping() or Mongoose connection.readyState.
2. Add models (e.g., backend/src/models/chat.js using Mongoose):
   - chat schema matching the JSON in this doc.
   - Index on chat_id (or use _id) and last_updated_at.
3. Add API routes (Express) (e.g., backend/src/routes/chats.js):
   - GET /dbhealth -> calls db.ping() and returns 200/503.
   - POST /chats -> create new chat document and return id.
   - GET /chats -> list chats (id, name, last_updated_at).
   - GET /chats/:id -> fetch chat with messages.
   - POST /chats/:id/messages -> append message (atomic push + update last_updated_at).
   - Optionally PATCH /chats/:id to update name/config.
4. Transactional & failure handling:
   - For appending messages use updateOne({ _id }, { $push: { messages: msg }, $set: { last_updated_at: now } }) with writeConcern.
   - If the DB ping fails before/during an operation, return an error to frontend; frontend switches to local-only mode for that chat (store messages in local state until DB is available).
   - Do not crash on DB failures; route handlers should catch DB errors and return 503 + descriptive JSON.
5. Frontend behavior:
   - On app load call GET /dbhealth. If 200, treat as "dbAvailable".
   - If user starts a new chat and dbAvailable: create chat (POST /chats) on first user message, redirect to /chat/:chat_id and concurrently send the message to backend to store and to processing pipeline.
   - If dbUnavailable: stay on / with local-only chat; messages stored in local state; periodically retry health to recover.
   - When user opens existing chat: if dbAvailable fetch messages and render; if not, show disabled fetch notice and allow local-only composition.
6. Edge cases:
   - If DB connection drops mid-conversation, UI should continue receiving model output (local streaming) but mark DB writes as failed; show status indicator per message (success/failure/interrupted).
   - Consider batching local-only messages to persist when DB comes back (user opt-in).
7. Tests & monitoring:
   - Add unit tests for db.ping, chat creation, append message.
   - Add basic integration test to simulate DB down/up flows.
8. Deployment:
   - Make MONGO_URI, DB_HEALTH_RETRY_INTERVAL configurable.
   - Log health events and expose /metrics if needed.

Minimal implementation notes/snippets to follow conventions
- Use environment var MONGO_URI; default: mongodb://localhost:27017/customgpt
- Health implementation example idea:
  - With MongoClient: client.db('admin').command({ ping: 1 })
  - With Mongoose: connection.readyState === 1 or try connection.db.admin().ping()
- Use UUIDs or Mongo ObjectId for message_id/chat_id.

Acceptance criteria checklist
- /dbhealth returns 200 when DB reachable, 503 otherwise.
- Creating a chat when dbAvailable returns chat_id and the UI redirects to /chat/:chat_id.
- Fetching existing chats returns list for sidebar when dbAvailable.
- App gracefully falls back to local-only mode when DB unavailable and shows message status indicators.