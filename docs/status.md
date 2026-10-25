# Build status — October 24, 2026

## Implemented

- TypeScript workspace: React MV3 extension, Express/SQLite backend, shared Zod runtime schemas, official MCP SDK.
- Explicit session start/pause/resume/finish/reopen/rename/delete/export, saved preferences, scoped opener-tab collection, explicit include/exclude.
- Automatic Google query capture, bounded Readability article extraction, conservative overview adapter, selected-text shortcut/context menu.
- Persistent local mutations and retry alarms; authenticated ownership; duplicate protection; transactional analysis saves; version/reference/quiz validation; later captures remain pending.
- Evidence-depth map/list, node/edge evidence, chronology, honest Go prompt handoff, connection recall, flashcards, deterministic quiz, versioned attempts.
- Render deployment configuration with durable disk; private-repository readiness; teaching and demo documentation.

## Locally verified

- TypeScript validation, formatter check, production extension build, and all 32 focused tests passed.
- Ownership, capture retry/source attribution, stale/retried save rejection, invalid evidence/graph/quiz rejection, incremental attempts, bounded retrieval, SQLite reopen persistence, deleted-session capture rejection.
- Official MCP client over local HTTP: authenticated GetSession → fixture analysis through SaveSessionAnalysis → exact API retrieval. This is a harness, **not Go generation**.
- Packaged extension scripts in isolated Chromium: automatic search/article capture from intercepted synthetic pages, editable/input exclusion, highlight, pause, unrelated-tab exclusion, explicit include, authenticated sync, saved fixture display, evidence details, recall attempt persistence, flashcards, quiz, reload, narrow viewport, interrupted delivery, queued review recovery across a full browser-profile restart with collection paused and old tab bindings cleared, retry, and offline deletion without resurrection. Test-only manifest pregrants website access; production optional-permission prompt was separately approved and verified in the installed Chrome extension.
- UI screenshots visually inspected. `workspace-test.png` and `sidebar-test.png` are explicitly synthetic test data. They are not integration/demo results.
- Production dependency audit (`npm audit --omit=dev`) reports zero known vulnerabilities. The official Packs SDK development toolchain currently has six advisory entries (two high, four low), including its Zod 3 dependency; no compatible SDK fix is available. It is not imported by the production server. Compiled production server smoke test passed health and rejected unauthenticated research access (401).

## Reading first iteration

The user’s reading-first feedback is implemented: compact in-page capture indicator, opt-in gesture-based automatic highlights, stable source disclosures, static progressive radial map, richer optional Go output, explicit rebuilds, default quiz grid with immediate persisted answers, and matching. See [verification and limits](reading-first.md). New generation quality still needs a fresh real-source rebuild; synthetic tests do not prove that quality.

## UI redesign

The supplied RabbitHole redesign is implemented in the existing extension. See [UI redesign verification](ui-redesign.md) for the criterion-by-criterion checks, synthetic screenshots, local-font packaging, and the distinction between isolated UI tests and earlier live Go verification. The new “Partly” rating extends the accepted review enum without changing existing saved attempts.

## Repository

Private repository created and verified: https://github.com/anshulkhandekar/RabbitHole. Source is committed and pushed to main; .env, database files, build output, and live account screenshots are excluded.

## Live account verified

- Runnable chat URL verified: `https://go.superhuman.com/agents/72133`. Existing signed-in RabbitHole agent settings found at `https://go.superhuman.com/builder/52b17c07-ad35-4690-9584-007c60165e15`.
- Replaced its generic starter description/instructions with the RabbitHole evidence/processing configuration. Save completed (Save button disabled; no unsaved-changes state).
- Private RabbitHole connector Pack 74898, released v2, uses per-user HeaderBearerToken and the hosted Streamable HTTP endpoint. It was built/released in Studio, authenticated, attached to the existing agent, and validated locally with the official Packs SDK 1.18.4. Read approval is Always allow; Write remains Always ask.
- User installed the unpacked production extension. Hosted backend, personal token and actual Go agent URL were saved with authorization; Chrome website capture access was approved.
- Real redeployment persistence was verified through Go: version 2, four captures, zero pending and eight study items survived deployment of commit 93812ce. GetSession intentionally does not return review attempts; retained attempt verification came from the extension UI after merging.
- A repeat run with zero pending captures performed GetSession and left version 2 unchanged without another write.
- **Live Gate A passed:** Google search plus NVIDIA GPU Gems article → GetSession → Go-generated 9 concepts, 10 relationships and 6 study items → approved SaveSessionAnalysis v1 → extension sync displayed that exact saved map with original evidence. Session `77d34230-715f-4ccb-8681-3a0925a497d0` contains intentionally collected public material.
- Live pause kept a new CUDA documentation page out of capture. Resume plus navigation captured its readable text. Native Alt+Shift+H captured the intentionally selected CUDA paragraph as an important highlight. Unrelated mail/navigation did not enter this session (four captures remained).
- Live connection recall was attempted and saved. Go-generated flashcard reveal and deterministic quiz grading were exercised. A save-completion race after switching practice modes was reproduced with a held HTTP review response; the regression failed before the fix and passed afterward. Completion now belongs to the specific session/version/study item.
- A second real Go merge saved version 2 against the CUDA article/highlight. The installed extension displayed the new title, four processed captures, zero pending, and one retained attempt for the original connection item. Source-scope safeguards were added and saved in the live agent. Share with support is enabled with user authorization; general publishing/sharing is blocked by the organization.

The authenticated local backend is also running at http://localhost:3210. Credentials were generated into ignored .env without printing or publishing the token. The user created a Render account through GitHub. Deployment is prepared in the dashboard; the Render GitHub App installation for RabbitHole only was approved and its repository access verified. The user approved billing and created the service at https://rabbithole-1c5e.onrender.com (Render service srv-dbefk8navr4c73ap9d30). Its 1 GB disk at /var/data is verified. Missing environment configuration was added and a generated token saved. A cached SQLite binary built under Node 24 was identified from logs after switching to Node 22; the actual build command was corrected to npm ci. The rebuild is Live, `/health` returned 200, and unauthenticated `/api/sessions` returned 401. The extension and Go both authenticated successfully.

## Submission verification

- [x] Deploy a publicly reachable authenticated backend with durable storage; validate actual hosting configuration/cost ($7 compute + $0.25 disk/month before tax/extra usage).
- [x] Create/install and authenticate the private MCP connector; attach its tools to the existing agent.
- [x] **Gate A:** genuine captures → actual Go read/generation → confirmed write → exact displayed map.
- [ ] **Gate B:** five-minute real Google/article/highlight trail; packaged native Chrome permission/shortcut/context-menu check; real network failure and browser restart recovery.
- [x] **Gate C core:** real evidence/connection display, recall/flashcard/quiz interaction, incremental Go merge, retained progress.
- [ ] **Gate D:** real demo rehearsal, Share with Support, public Loom visibility, current organizer rules.
- [x] Record actual write approval: one Approve for each save. The earlier live flow from unsynced captures used six discrete actions: Sync, Open in Go, paste, Send, Approve, Sync. Already-synced captures remove the first action. Focusing/returning to the extension adds navigation.

## Limits and deferred features

Overview parser is intentionally narrow and not verified against current live Google DOM variants. A failed extraction uses explicit selection. Automatic collection does not perform semantic filtering; observable tab lineage defines the trail. Browser restart conservatively clears tab associations and pauses active sessions; include the research tab and resume afterward. A restored Chrome tab ID is not treated as proof of continuity.

No unlimited archive, import, OAuth signup, multi-instance database scaling, advanced scheduling guarantees, browser-side LLM, OCR, uploads, spaced repetition, Slack trigger, MCP App, or instant personalized highlight answer. Evidence-depth rows support map interaction without graph physics. Permanent sync failures can block the queue and require intervention. No competition outcome or learning improvement is promised.

## Implementation gates

- [x] Local Gate A harness and display path.
- [x] Local Gate B/C core implementation and synthetic browser exercise.
- [x] Live Gate A evidence.
- [x] Live incremental Go merge and retained progress.
- [ ] Real Chrome profile restart/network recovery rehearsal (isolated packaged tests pass).
- [ ] Submission Gate D.

The organizer’s current Submitting Your Agent page was reviewed on October 24: it says October 31 and requires a short write-up, agent link, and video. Loom/under-five-minutes remains the brief’s documented requirement. Custom scheduling offers Hour/Day/Week/Month units (minimum visible interval one hour); no schedule was enabled and unattended saves have not been verified.
