> Historical checkpoint / audit. For the current build, use the [documentation index](README.md), [status](status.md) and [release checklist](release-checklist.md). Dated results below are not current live sign-off.

> Current Stage 3 release: see [the test/release guide](stage-3-ready.md) and [current status](status.md). The Stage 2 handoff below is retained as history.

# Stage 2 checkpoint → Stage 3 handoff

Updated October 26, 2026. Copy the continuation prompt below into a new chat opened in `/Users/anshulkhandekar/RabbitHole`, then add your discovered issues and chosen features. Stage 2 is implemented and built locally, but **has not passed every installed-extension acceptance check**.

---

You are continuing RabbitHole after the Stage 2 redesign and user-reported startup, capture, indicator and Go fixes. Work in `/Users/anshulkhandekar/RabbitHole`, private remote `anshulkhandekar/RabbitHole`, branch `main`. My new feedback determines Stage 3 scope. Do not implement the entire future-features list automatically. If I have not supplied priorities, load this checkpoint and ask for them.

## Read first

1. `docs/handoff.md` and `docs/rabbithole-v2-verification.md` for current implementation and verification limits.
2. Current Git status, `docs/maintenance.md`, and applicable repository/skill instructions.
3. For design changes, the source-of-truth `/Users/anshulkhandekar/ai-toolkit/smoke-test/rabbithole-design/REDESIGN-V2.md`, then `workspace.html`, then `tokens.css`, `icons.js` and `data.js` in that folder. Serve the prototype from its folder with `python3 -m http.server 8765`.
4. Before capture, persistence or Go changes, read `docs/architecture.md`, `docs/data-flow.md` and `docs/go-agent-setup.md`, checking their descriptions against current code.

`docs/stage-1.md`, `docs/status.md` and `docs/reading-first.md` contain historical context. Their radial-map, inspector, practice and deferred-memory descriptions do not supersede Stage 2. External `FUTURE.md` is a list of candidates, not approved implementation scope.

## Current product and Stage 2 changes

RabbitHole is a Chrome MV3 extension, authenticated Express/SQLite backend and Superhuman Go agent. Included research tabs provide captures; Go owns generative reasoning. There is no separate external LLM runtime in the backend.

- Supplied neutral light/dark tokens copied as-is, carrot attention accent, neutral brand assets, locally bundled Geologica/Literata fonts. Historical palette words survive only in comments inside the verbatim supplied token file.
- Workspace has one top bar and **Summary / Map / Practice / Sources** tabs, without permanent left rail or right inspector. Idea/connection selection opens a slide-over drawer, becoming a bottom sheet below 900px. Narrow layouts wrap tabs to a second row.
- Summary contains the overview, takeaways and reading route.
- React Flow remains, with measured nodes before ELK layered layout partitioned by depth. Reverse relationships merge into one drawn connection per unordered pair while retaining their meanings. Ports spread apart; focused labels stay in world space with a collision pass. Fit-view minimum zoom is 0.7. Radial layout is removed. Search, layers and guided Walk the route are implemented.
- Quick dig mixes up to eight activities within a session, prioritizing shaky ideas. Quiz gives immediate checked feedback; matching locks correct pairs immediately, draws lines and retains wrong slips; explain-link activities reveal the explanation and accept self-rating; flashcards flip and accept self-rating. Feedback sheets, results, retry-missed and memory updates are implemented.
- Memory is derived **on the client** from saved practice attempts and recency: strong, shaky or untested. It appears on the map, drawer, Summary and Practice. This is not FSRS or a scientifically calibrated forgetting curve; no backend memory model was added.
- Optional data fields include `session.short`, `concept.main`, analysis summary/takeaways with concept targets/route, `studyItem.concept` and matching `pairs[].concept`. Legacy overview remains supported.

The sidebar initially received token changes only. The later startup, inclusion, handoff-status and indicator changes below were specifically requested by the user; this was not a general sidebar redesign.

## User-reported fixes implemented

- Expanded view can start a named session without treating its own extension page as an unsupported research page. Title and start are sent together. Sidebar and workspace share active state; an old finished session stays finished.
- After an explicit start, new Google searches automatically join the collecting session. Opening the sidebar on a fresh search enrolls it before extraction, avoiding the transient Include tab warning. Other pages require explicit inclusion or research-tab lineage. Exclusions, pause, finished sessions and incognito remain respected. Browser restart pauses collection and clears tab bindings/automatic enrollment.
- Workspace tab context refreshes correctly; the empty-start hint is hidden once captures exist.
- Per-session handoff receipts are shared across sidebar/workspace and refreshed by background alarms. UI shows **Waiting for Go**, then **Check Go** after ten minutes. It clears after the saved version advances and the submitted batch is processed; batches are capped at 24 captures. This reports delivery state, not observation of Go thinking, pasted prompts or approval.
- Reading bunny has theme-aware contrast, free dragging, viewport clamping and normalized saved position. It pulses green for a newly saved find, spins while waiting and shows red for sync/stalled status; duplicates do not reflash. Paused/not-included state is neutral. Unrelated tabs can receive indicator metadata without source extraction. Hiding it does not pause collection.
- Alt/Option+Shift shortcuts: **R** sidebar, **M** expanded workspace, **B** hide/show bunny, **H** save selected text. Native browser conflicts still need manual verification.

## Go integration and save-loop recovery

Hosted saves were returning **422 validation failures**; Go reported invalid exact quotations. Approved/retried payloads also differed in capture IDs. Do not describe this as proven lost writes or assume one specific ID error caused every failure.

Two backend commits are pushed and deployed:

- `392515e`: read-only analysis preflight, actionable unknown-ID errors and preservation of V2 summary fields.
- `db360f1`: save validated drafts by reference so Go does not have to reproduce the complete JSON after preflight.

Current tools are ListSessions, GetSession, **ValidateSessionAnalysis**, **SaveValidatedAnalysis**, and legacy SaveSessionAnalysis. Preflight checks without changing session analysis/version/processed captures, returning a preview and short save arguments. Normal write approval remains **Always ask**. The temporary draft cache is owner/session bound, limited to 32 entries and 30 minutes, and lost on server restart/eviction. Save rechecks version/validation; replaying an already saved reference returns its receipt without another version increment. Expired drafts require revalidation.

Live preflight caught an invalid excerpt, then validated after removing only that optional unverifiable excerpt while retaining useful guide content. Go subsequently read all seven captures afresh and reached a **Save Validated Analysis** approval card titled “A staged plan for coding, system design, and AI-era interview preparation.” **Final approval was left to the user; no completed save or new saved version was verified.** Check the user's outcome/read current state before claiming this is resolved. The old draft may have expired.

Relevant conversation: <https://go.superhuman.com/tasks/2bfc7f12-f376-4bbd-b0c5-12bb5b351d49>; session `808af8dd-3803-40b6-a2d3-59f17e8442bd`.

Live configuration:

- Agent: <https://go.superhuman.com/agents/72133>.
- Builder: <https://go.superhuman.com/builder/52b17c07-ad35-4690-9584-007c60165e15>.
- Private connector **Pack 74898, release 6**, endpoint `https://rabbithole-1c5e.onrender.com/mcp?schema=4`.
- Backend `https://rabbithole-1c5e.onrender.com`; Render `srv-dbefk8navr4c73ap9d30`, one instance, durable `/var/data/rabbithole.sqlite`.
- Canonical instructions `integrations/superhuman/agent-instructions.md`; live snapshot `integrations/superhuman/live-agent-instructions.txt`.

Pushing `main` auto-deploys the backend. Connector release and live agent settings are separate updates; Git alone does not change them. Verify actual discovered tools/fields after schema changes because Go can cache discovery.

Send to Go still copies a prompt and opens the configured Go URL. The user sends it and approves writes. Reusing a saved conversation across days, a copy-only Go-sidebar mode, automatically opening/prefilling Go's sidebar and a webpage/RabbitHole/Go three-column layout are **not implemented**. No supported direct invocation/sidebar-control API has been established. Investigate supported integration before promising those behaviors; arranging another extension requires a compatibility prototype.

## Git, installation and verification checkpoint

**The V2 extension UI and follow-up capture/indicator changes remain uncommitted in the local working tree**, built into `dist/extension`. Only the two backend commits above are pushed/deployed. Preserve all existing modified/untracked files. There is no Stage 2 milestone commit/tag; `stage-1-complete` is historical.

Last recorded full-tree verification: **56 tests passed**, typecheck and production extension/server builds via `npm run check`; `npm run lint` and `git diff --check` passed. Exact deployed backend commit verification separately passed 36 tests plus typecheck/build. These are recorded results, not checks rerun by this documentation update.

The isolated built-UI Starting Investing fixture passed keyboard-only eight-item Quick dig runs in both themes, feedback/results/memory, search, route navigation and 880px drawer/tab behavior. Its measured map had nine cards and eleven merged connections, zoom about 0.992, no sampled edge/card intersections and no focused-label/card or label/label overlaps. A separate widget fixture checked contrast, dragging, waiting and error states.

Still outstanding:

- Full **installed-extension Starting Investing §9 pass in both themes**, including actual stored-session persistence and delivery. Chrome extension-management access was blocked by browser security policy; no workaround was used. User manual testing has begun.
- Final real Go approval/save/read-back for the short-reference workflow.
- Updated `tests/browser.ts` execution, native shortcut/panel behavior and runtime reduced-motion emulation. Reduced-motion code exists, but runtime preference behavior was not verified.
- Broader map geometry checks. Crossing gaps separate painted strokes, but zero geometric crossings are not guaranteed. A strict zero-intersection interpretation of §9 remains unmet. Historical intermittent missing edge rendering after refresh was not conclusively diagnosed; do not assume the layout rewrite alone closes it.

Use `npm run check`, `npm run lint`, `npm run test:browser` and `npm run test:reload` as appropriate; consult maintenance docs for `CHROMIUM_PATH`. Do not delete `dist/extension`: Chrome loads that folder. Reload the unpacked extension after rebuilding and refresh research pages to activate changes.

Safe UI-only preview: `npm run build`, then `node scripts/redesign-preview.mjs`; open `http://127.0.0.1:8766/index.html?workspace=1`, `/responsive.html` or `/reading.html`. These use isolated fixtures and do not prove installed-extension behavior.

## Stage 3 candidates: future ideas still unimplemented

Choose from these based on my feedback, alongside fixes I discover. Do not treat them as a delivery commitment.

- **Déjà vu** Google recall cards linking searches to saved concepts/aliases and existing practice, with opt-in/throttling/dismissal.
- **Burrow back** daily review across sessions. Existing Quick dig is within one session; unattended generation/scheduling is not established.
- A per-idea practice ladder/progression. Having four activity types does not implement the ladder.
- Build-the-map challenge where users draw/label relationships, with honest comparison and optional Go feedback.
- Additional activity formats: rapid fire, source detective, order the steps, contrast pairs, spot the error, fill-the-map, worked-to-faded examples, problems with hint ladders, predict outcomes, teach-back and analogy checks. Prioritize quality over adding the whole catalogue.
- Study recipes/profiles such as exam, build, interview or teach; numeric/code styles, adjustable run length and hard mode. Existing depth/analogy/activity preferences are already implemented.
- Gap-to-search actions: gaps are displayed, but actionable next-search chips are absent. A confusing-highlight tag exists; targeted explanation/example/question packets do not. Capture lineage exists; “why did I open this tab?” explanatory context UI does not.
- **Warren** cross-session concept graph, animated trail replay (distinct from Walk the route), read-only session sharing, richer Anki/Quizlet/Markdown/Notion exports and in-page evidence underlines when revisiting sources. Existing evidence links and raw JSON export are not these features.
- User-requested Go conversation/sidebar options described above, if supported.

Do **not** re-propose memory-map basics, matching, flashcards, quizzes, explain-link reveal, mixed Quick dig, retry-missed, existing preferences or source provenance as wholly new features. Those are implemented; improve them only in response to observed gaps.

Other known limitations remain: no import/restore UI; limited Google AI Overview parsing; finite capture/storage and queue recovery; static personal-token authentication/single SQLite instance; no established direct Go trigger; no per-find deletion UX (excluding a page does not delete its saved finds). Final demo/recovery rehearsal, judge access and competition submission are separate outstanding work, not automatic Stage 3 scope.

## Preserve these rules

- Help users reconstruct understanding from actual browsing and evidence. Test mechanisms/examples/boundaries with plausible distractors; prefer objective practice where appropriate. Avoid shallow mini-game volume, guilt streaks and universal all-tab capture.
- No fake progress, fabricated evidence, invented quotations or scientific learning-score claims. Label inferred/supplemental relationships; layout is navigation, not evidence.
- Preserve authentication, owner/version safeguards, privacy, exclusions, captures, databases, `.env`, saved connections and sessions. Use isolated synthetic data for tests; check user authorization before changing real session data.
- Never invent captures to bypass the no-new-content guard. Explicit rebuilds retain version protection. Correct invalid fields without discarding a useful complete guide.
- Keep the repo private, credentials out of logs/screenshots, and licenses intact. Do not broaden permissions, sharing or hosting costs without authorization.
- Apply debugging/TDD/verification skills when relevant and Context7 for platform/API work. Reproduce discovered bugs, carry agreed changes through checks, and distinguish fixture evidence from live proof.

My Stage 3 priorities / discovered fixes:

[Add my list here.]
