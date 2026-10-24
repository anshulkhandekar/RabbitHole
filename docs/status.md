# Build status — October 24, 2026

## Implemented

- TypeScript workspace: React MV3 extension, Express/SQLite backend, shared Zod runtime schemas, official MCP SDK.
- Explicit session start/pause/resume/finish/reopen/rename/delete/export, saved preferences, scoped opener-tab collection, explicit include/exclude.
- Automatic Google query capture, bounded Readability article extraction, conservative overview adapter, selected-text shortcut/context menu.
- Persistent local mutations and retry alarms; authenticated ownership; duplicate protection; transactional analysis saves; version/reference/quiz validation; later captures remain pending.
- Explore graph/list, node/edge evidence, chronology, honest Go prompt handoff, connection recall, flashcards, deterministic quiz, versioned attempts.
- Render deployment configuration with durable disk; private-repository readiness; teaching and demo documentation.

## Locally verified

- TypeScript validation, formatter check, production extension build, and all 10 focused tests passed.
- Ownership, capture retry/source attribution, stale/retried save rejection, invalid evidence/graph/quiz rejection, incremental attempts, bounded retrieval, SQLite reopen persistence, deleted-session capture rejection.
- Official MCP client over local HTTP: authenticated GetSession → fixture analysis through SaveSessionAnalysis → exact API retrieval. This is a harness, **not Go generation**.
- Packaged extension scripts in isolated Chromium: automatic search/article capture from intercepted synthetic pages, editable/input exclusion, highlight, pause, unrelated-tab exclusion, explicit include, authenticated sync, saved fixture display, evidence details, recall attempt persistence, flashcards, quiz, reload, narrow viewport, interrupted delivery, queued review recovery across a full browser-profile restart with collection paused and old tab bindings cleared, retry, and offline deletion without resurrection. Test-only manifest pregrants website access; production optional-permission prompt is unverified.
- UI screenshots visually inspected. `workspace-test.png` and `sidebar-test.png` are explicitly synthetic test data. They are not integration/demo results.
- Dependency audit after Zod update reported zero known vulnerabilities at build time. Compiled production server smoke test passed health and rejected unauthenticated research access (401).

## Repository

Private repository created and verified: https://github.com/anshulkhandekar/RabbitHole. Source is committed and pushed to main; .env, database files, build output, and live account screenshots are excluded.

## Live account verified

- Runnable chat URL verified: `https://go.superhuman.com/agents/72133`. Existing signed-in RabbitHole agent settings found at `https://go.superhuman.com/builder/52b17c07-ad35-4690-9584-007c60165e15`.
- Replaced its generic starter description/instructions with the RabbitHole evidence/processing configuration. Save completed (Save button disabled; no unsaved-changes state).
- No connector, extra tool access, trigger, sharing setting, or approval bypass was enabled. This is configuration verification only, not a generation/read/write test.

The authenticated local backend is also running at http://localhost:3210. Credentials were generated into ignored .env without printing or publishing the token. The user created a Render account through GitHub. Deployment is prepared in the dashboard; installing the Render GitHub App for RabbitHole only is awaiting explicit access approval.

## Still required before submission

- [ ] Deploy a publicly reachable authenticated backend with durable storage; validate actual hosting configuration/cost.
- [ ] Create/install the generated MCP connector, authenticate the school Go account with an isolated personal token, attach its three tools to the existing agent.
- [ ] **Gate A:** genuine captures → actual Go read/generation → confirmed write → exact displayed map.
- [ ] **Gate B:** five-minute real Google/article/highlight trail; packaged native Chrome permission/shortcut/context-menu check; real network failure and browser restart recovery.
- [ ] **Gate C:** meaningful evidence/connection quality, real incremental Go merge, retained progress. Synthetic fixture exercise is not sufficient.
- [ ] **Gate D:** real demo rehearsal, Share with Support, public Loom visibility, current organizer rules.
- [ ] Record actual Go write confirmation and interaction count. Design expects roughly 4–5 actions after capture; this is not yet measured in the live account.

## Limits and deferred features

Overview parser is intentionally narrow and not verified against current live Google DOM variants. A failed extraction uses explicit selection. Automatic collection does not perform semantic filtering; observable tab lineage defines the trail. Browser restart conservatively clears tab associations and pauses active sessions; include the research tab and resume afterward. A restored Chrome tab ID is not treated as proof of continuity.

No unlimited archive, import, OAuth signup, multi-instance database scaling, advanced scheduling guarantees, browser-side LLM, OCR, uploads, spaced repetition, Slack trigger, MCP App, or instant personalized highlight answer. Fixed grid positions support map interaction, not physics. Permanent sync failures can block the queue and require intervention. No competition outcome or learning improvement is promised.

## Implementation gates

- [x] Local Gate A harness and display path.
- [x] Local Gate B/C core implementation and synthetic browser exercise.
- [ ] Live Gate A/B/C evidence.
- [ ] Submission Gate D.
