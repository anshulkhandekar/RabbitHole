# Five-minute architecture walkthrough

**Minute 1 — the problem and capture.** “I want to preserve an intentional trail and be able to explain its connections later.” Start a session in Chrome's side panel. A content script sees the loaded page and sends bounded text to the service worker. A content script interacts with a page; the worker handles extension events and may sleep between them.

**Minute 2 — persistence and boundaries.** Show Sources and the captured/pending status. Local extension storage keeps research while offline. The worker sends queued mutations with your personal token. An Express API derives your owner from authentication, validates data, and persists it to SQLite. The public deployment mounts a persistent disk, so redeploys do not erase research. Unrelated tabs stay excluded unless they have an included opener or you explicitly include them.

**Minute 3 — Go does the thinking.** Open in Go copies a prompt and opens the configured URL; sending it is a user action. Go reads through GetSession, reasons over the actual captures and preferences, and asks to save using SaveSessionAnalysis. The connector is a bridge to tools, not a trigger. Go is the generative engine; the backend has no external LLM API key.

**Minute 4 — evidence and change.** Inspect an idea and an edge in Explore. Both link to captured sources. Direct support and inferred relationships differ. SaveSessionAnalysis checks expectedVersion and evidence IDs. If more research arrives while Go is thinking, it stays pending. A later run merges into the existing graph. Invalid or stale writes cannot partly update it.

**Minute 5 — learning and honesty.** Try Explain the connection before revealing the explanation. Rate your answer. Show a flashcard or quiz. The UI can check a multiple-choice index; it cannot honestly judge arbitrary prose as AI. A fresh critique uses Go. Close/reopen the workspace to show saved progress, then state which live integrations were actually tested.

## Questions judges may ask

| Question                                | Accurate answer                                                                                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Why not paste everything into chat?     | Enabled browsing captures a bounded trail automatically, and results persist as a source-linked map plus activities.                                                                                                            |
| What does Go do?                        | Extracts/merges concepts, reasons about relationships, applies preferences, generates study material, and provides deeper feedback through its connected tools.                                                                 |
| Is the Process button automatic?        | No. It opens Go and attempts to copy an exact prompt. The user sends it and may approve the save.                                                                                                                               |
| Why an extension?                       | It can observe the user's explicitly enabled research tabs and selection without repeated uploads.                                                                                                                              |
| Can another person guess my session ID? | IDs alone do not authorize access. Every API/tool uses the authenticated owner's token.                                                                                                                                         |
| What happens offline?                   | Captures and mutations queue locally and retry. The UI distinguishes pending sync and pending analysis. Device storage still has limits.                                                                                        |
| How are hallucinations prevented?       | References and versions are structurally validated; Go must cite actual captures and label inference. Semantic correctness still needs source inspection.                                                                       |
| Do you store everything I browse?       | Only enabled included tabs; no incognito. Inputs/editable fields are excluded. Pause stops recording. A clean public-source profile is used for demos.                                                                          |
| What do quiz scores prove?              | Only whether a chosen option matches the saved answer; self-ratings are user judgments, not measured learning gains.                                                                                                            |
| What is unfinished?                     | Hosted Go read/write and incremental merging are verified. Final timed video/recovery rehearsal remains; scheduled write behavior is untested. General publishing is organization-blocked, while Share with support is enabled. |

## Commands and endpoints

`npm run setup:local` creates ignored credentials. `npm start` runs the API. `npm run check` runs types/tests/build; `npm run lint` checks formatting. `npm run test:browser` runs the isolated extension harness after Playwright Chromium installation. `dist/extension` is loaded unpacked.

`GET /health` is public operational health. Authenticated `/api/sessions` creates/lists; `/api/sessions/:id` reads, patches, exports (JSON read), and deletes; child `/captures` and `/reviews` accept deterministic writes. `/mcp` exposes ListSessions, GetSession, SaveSessionAnalysis to Go. REST does not offer a separate generative endpoint. A synthetic fixture can exercise saving through the MCP test harness; fixtures are not Go output.
