> Historical checkpoint / audit. For the current build, use the [documentation index](README.md), [status](status.md) and [release checklist](release-checklist.md). Dated results below are not current live sign-off.

# Stage 1 checkpoint

Stage 1 closes on October 24, 2026: an implemented, deployed research-to-learning prototype with real Go read/write verification. This is a development milestone, not final competition submission, a production-readiness claim, or a claim that all usability problems are solved. The user has additional major fixes and feature ideas to provide in the next chat.

Read [current status](status.md) for evidence and limits, [handoff](handoff.md) for the next-chat prompt, and [maintenance](maintenance.md) before changing local files or deployment state.

## Product at this checkpoint

RabbitHole preserves an intentionally enabled research trail so the user can focus on reading, then return to a source-linked learning guide. The extension collects; Superhuman Go reasons; the backend validates and stores; the extension presents the saved map and practice. The competitive value still needs user evaluation: useful mechanisms, specific connections and easy return to evidence, rather than merely accumulating tabs or producing generic summaries.

| Area                 | Implemented behavior                                                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capture scope        | Start/pause/resume/finish sessions; include/exclude tabs; observable opener lineage; no incognito capture; unrelated tabs excluded                              |
| Sources              | Google search strings, bounded readable article text, conservative AI Overview extraction, manual selected-text capture                                         |
| Quiet reading        | Read without sidebar; compact static rabbit indicator on included pages; pause/resume/hide/reopen controls                                                      |
| Automatic highlights | Per-session opt-in; completed trusted pointer/keyboard selection after 750 ms; editable and programmatic selections excluded                                    |
| Persistence          | Chrome local sessions and mutation queue; authenticated sync/retry; durable single-instance SQLite on Render                                                    |
| Map                  | Progressive radial overview and branches; selected-node/edge inspector; alternate chronological trail and accessible list; static inferred/supported edges      |
| Guide                | Optional overview/root/route, parent hierarchy, takeaways, illustrations, boundaries and exact source excerpts; legacy maps remain readable                     |
| Practice             | Default 2×2 quiz with deterministic persisted grading and choice explanations; matching against saved pairs; optional connection self-assessment and flashcards |
| Go handoff           | Copy a session-specific prompt, open the real agent, user sends, confirmed write, observe actual saved version                                                  |
| Rebuild              | Explicitly enrich already-processed evidence with `intent: "rebuild"`; empty processed IDs allowed; ordinary no-new-content processing remains a no-op          |
| UI                   | Supplied tokens and SVG icons/brand; bundled Geologica/Literata fonts; light/dark, 320px panel, reduced motion and keyboard interaction                         |

## Architecture and ownership

| Source                                                | Responsibility                                                                                                          |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `apps/extension/src/content.ts`                       | Bounded extraction, trusted selections, reading indicator, orphaned-context cleanup; no backend credential              |
| `apps/extension/src/background.ts`                    | Membership and lifecycle checks, credentials in trusted extension context, local queue, sync and Go prompt construction |
| `apps/extension/src/ui.tsx`                           | Shared side-panel/workspace/options UI, session orchestration and stable inspector                                      |
| `MapView.tsx`, `ui-model.ts`, `Trail.tsx`             | Map organization, progressive navigation and chronological views                                                        |
| `Practice.tsx`, `Matching.tsx`                        | Saved-answer checking, activity display and attempt persistence                                                         |
| `apps/server/src/app.ts`                              | Authenticated REST and official Streamable HTTP MCP transport                                                           |
| `apps/server/src/store.ts`                            | Owner-scoped SQLite, atomic saves, optimistic versions, references, exact quotations and review validation              |
| `packages/contracts/src/index.ts`                     | Shared Zod contracts and bounds                                                                                         |
| `integrations/superhuman/pack.ts`                     | Deployed private MCP connector configuration                                                                            |
| `integrations/superhuman/agent-instructions.md`       | Canonical description/instructions for the live Go agent; not automatically deployed by Git                             |
| `integrations/superhuman/live-agent-instructions.txt` | Recorded current live instruction text                                                                                  |
| `tests/`                                              | Unit/contract/MCP boundaries and isolated packaged-extension browser harnesses                                          |

See [architecture](architecture.md) and [data flow](data-flow.md) for transport, retry and storage details.

## Live integration inventory

These identifiers are operational references, not credentials. Do not provision replacements unless needed and authorized.

- Private repository: https://github.com/anshulkhandekar/RabbitHole, branch `main`.
- Runnable Go agent: https://go.superhuman.com/agents/72133.
- Agent builder: https://go.superhuman.com/builder/52b17c07-ad35-4690-9584-007c60165e15.
- Private connector: Pack **74898**, released **v4**; `HeaderBearerToken`; Read **Always allow**, Write **Always ask**.
- Connector endpoint: `https://rabbithole-1c5e.onrender.com/mcp?schema=2`.
- Backend origin: https://rabbithole-1c5e.onrender.com.
- Render service: `srv-dbefk8navr4c73ap9d30`; Node 22.20.0; `npm ci --include=dev && npm run build`; `npm start`; `/health`.
- One instance; 1 GB persistent disk mounted at `/var/data`; SQLite `/var/data/rabbithole.sqlite`.
- Previously approved hosting: $7/month compute plus $0.25/month disk, before tax and extra usage. This records the approved setup, not a current price quotation or permission to increase spending.
- Git pushes to `main` auto-deploy the service. Changing Go instructions or connector code requires a separate live save/build/release.
- Share with support enabled with user approval. General sharing/publishing is organization-blocked; no public repository or general agent publication is authorized.

Local `.env` and `data/` are private development state. They are not the hosted database or a substitute for Render credentials. Chrome has its own saved extension connection. Never print tokens, put them in docs, or copy real research into fixtures.

## Verified incidents and fixes

### Extension reload errors

Chrome showed repeated uncaught “Extension context invalidated” errors from old content scripts. Messaging now catches synchronous throws and rejected promises; invalidation disconnects observers, aborts DOM listeners, clears timers, and removes the collecting indicator. In-flight work cannot restart a retired script. Re-injection wakes a live script without a new unhandled messaging promise.

The isolated `test:reload` harness invokes actual `chrome.runtime.reload()` and verifies stale-indicator removal and no uncaught page errors across subsequent polls. It does not establish the native Reload-button/page-refresh recovery flow. After updating the unpacked extension, reload its card and refresh existing research/Go pages once. Historical Chrome Errors entries can remain after the underlying problem is fixed.

### Rebuild connector mismatch

Go reported that `intent` was absent and attempted a no-new-captures save. The backend already accepted explicit rebuilds. Fresh Go diagnostics still saw the old parameter schema after a connector-only v3 release. Versioning the same endpoint as `/mcp?schema=2` in connector v4 exposed the current fields. This is an observed discovery workaround, not a documented guarantee about every Go cache. Future tool-contract changes need live schema verification in a fresh chat.

The live retry then encountered stale-version and exact-quotation errors. The backend's exact-quote error now lists every offending evidence path, item ID and capture ID without echoing the quoted source text. This supports targeted corrections while keeping other guide content. Validation remains strict and atomic; do not bypass it or invent captures to force processing.

With explicit user approval, the investing session rebuild subsequently saved **version 3**, with **0 new captures processed / 0 pending**. Go performed a post-save GetSession and confirmed the rich fields; the backend independently logged `analysis_saved` version 3. The extension's display of this specific rebuilt version was not separately rechecked in that run.

## Verification ledger

| Evidence                                            | What it establishes                                                                                                               | What it does not establish                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run check`: 32 tests, typecheck and build      | Owner/version/reference validation, quote and hierarchy checks, review grading, contracts, real local MCP transport, buildability | Real Go output quality or every native browser interaction                                      |
| `npm run lint`                                      | Repository formatting                                                                                                             | Runtime correctness                                                                             |
| `npm run test:browser`                              | Synthetic packaged-extension capture/scope/sync/retry/restart/delete, map/practice, 320px light/dark and local fonts              | Current Google variants, real Go generation, native permission dialogs or native panel gestures |
| `npm run test:reload`                               | Actual runtime invalidation cleanup in a disposable Chromium profile                                                              | Native installed-extension recovery after refresh                                               |
| `npx coda validate integrations/superhuman/pack.ts` | Connector definition accepted by SDK                                                                                              | Go has actually discovered the latest schema                                                    |
| Genuine GPU session v1/v2                           | Go generation, approved saves, displayed map, incremental merge and retained original attempt                                     | New rich-guide quality across topics                                                            |
| Genuine investing rebuild v3                        | Current schema, explicit no-new-capture rebuild, approved write, rich-field read-back and backend save log                        | Consistently strong distractors, complete semantic correctness or competition readiness         |

The closeout dependency audit reports zero production advisories and six development-toolchain advisories (two high/four low), including Packs SDK dependencies. Those remain documented follow-up work; a milestone label does not erase them.

Closeout browser caveat: a concurrent run failed on missing map-edge labels after background refresh; the full isolated rerun passed. The cause is unconfirmed. See the reproduction details in [status](status.md); do not silently treat the first failure as irrelevant.

Real sessions are user data, not disposable fixtures. GPU reference session: `77d34230-715f-4ccb-8681-3a0925a497d0`. Investing rebuild session: `033a9e8a-3189-48bf-af7b-10582756680d`. Do not automatically rebuild or delete either in future tests.

Generated screenshots are intentionally excluded from the Stage 1 checkout. Tests recreate synthetic visual artifacts in ignored `test-results/`. They must never be presented as live Go output. Prior screenshots can exist in Git history; cleanup does not rewrite that history.

## Open work and Stage 2 boundary

The user's forthcoming issue list takes priority. Stage 1 is not an assertion that the product is already worth using or that all observed bugs are fixed. Important evaluation areas remain map clarity, depth and specificity of explanations, plausible quiz distractors, preservation of useful material during rebuilds, and focus while reading. Generated quiz options in the verified run still included easy distractors; structural validation cannot establish teaching quality.

Known technical limits: narrow Google Overview parser; observable rather than semantic tab inclusion; bounded capture/storage; conservative paused collection and cleared tab bindings after restart; permanent queue errors may require intervention; no import/restore UI; static personal-token prototype auth; single-instance SQLite; native panel/shortcut/recovery rehearsal still incomplete. Root/parent semantic coherence and unchanged-ID meaning also need human review beyond structural validation.

Deferred candidates include cross-session links, déjà vu reminders, spaced/daily review, additional activities, deeper feedback, and future direct or scheduled Go triggering if officially supported. No autonomous 30-second generation loop is implemented or promised. Do not implement this list wholesale before the user supplies priorities. The external redesign `FUTURE.md` remains a later-ideas reference, not the accepted next-stage scope.

Competition completion remains separate: confirm organizer rules close to submission, rehearse a genuine clean-source flow and recovery, prepare isolated judge access, record a clear video, and check its visibility. No competition outcome or measured learning benefit is guaranteed.
