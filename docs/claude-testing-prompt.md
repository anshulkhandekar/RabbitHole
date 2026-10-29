# RabbitHole independent release evaluation

You are independently testing RabbitHole as a release candidate. Your job is to understand the extension and Go agent, test every implemented user-facing feature and consequential data boundary, evaluate the generated learning experience, and decide whether this version is ready to freeze for a submission demo.

The goal is a trustworthy, engaging demonstration of the existing product. Do not add features, redesign the UI, or plan/edit the submission video yet. I will request video planning separately after reviewing your findings.

## 1. Working agreement

- Work in `/Users/anshulkhandekar/RabbitHole/rabbitv4-2`. Read applicable `AGENTS.md` instructions and inspect Git status before doing anything that changes files. Preserve existing changes.
- Test and report first. Do not fix product code, commit, push, deploy, publish a connector, alter live agent instructions, change account permissions, or rotate credentials without a separate instruction. You may write the test plan/report and add isolated regression tests when needed to establish a finding; identify those changes.
- You may create clearly named disposable RabbitHole test sessions, browse public research sources, practice in those sessions, and send their intended prompts to the configured RabbitHole Go agent. Keep all test mutations confined to these sessions. Do not change or delete my personal research sessions. Do not send messages to other people.
- Use the real installed extension and real agent for integration testing. Use isolated profiles/databases for destructive, security, capacity and fault-injection tests. Never inject fixture analysis into a real session or present seeded results as Go output.
- Preserve normal Go write approval. Do not bypass it, weaken validation, or change Write to Always allow. If approval or a manual action is needed, name the exact test session and action so I can complete it.
- Never print tokens, read a saved token back into an input, put credentials into a report/screenshot, or record unrelated personal browser content. Use existing configuration without exposing it.
- Prefer available browser/app tooling and the repository's test harnesses. Check current official documentation for platform/API-dependent questions, following the repository's Context7 instructions. Do not assume unsupported browser or Go capabilities.
- Keep going on independent checks when one check is blocked. Ask me only for a specific missing action or access that you cannot obtain yourself. I can reload the extension, refresh research tabs, release/reconnect the connector, deploy, and approve intended Go saves manually.
- Keep testing bounded: run the full release suite once, then rerun affected checks only for failures or changed conditions. Reuse evidence from well-designed test scenarios. Do not send repeated expensive Go requests merely to collect more screenshots.

## 2. Learn the product and establish the version under test

Read these files before testing:

- `README.md`, `docs/architecture.md`, `docs/data-flow.md`, `docs/learning-design.md`.
- `docs/stage-3.md`, ALL of `docs/stage-4.md`, `docs/go-agent-setup.md`, `docs/maintenance.md`.
- `docs/status.md`, `docs/stage-3-ready.md`, `docs/handoff.md`, `docs/demo.md` for history and outstanding submission work.
- `apps/extension/manifest.json`, `package.json` and relevant existing tests.
- `apps/extension/src/ui.tsx`, `Settings.tsx`, `background.ts`, `content.ts`, `google.ts`, `capture-model.ts`, `selection.ts`, `handoff.ts`, `handoff-model.ts`, `go-chat-model.ts`, `Practice.tsx`, `practice-model.ts`, `settings-model.ts`, `MapView.tsx`, `map-layout.ts`, `IdeaDrawer.tsx`, `connection-model.ts`, `Trail.tsx`, and export/source/session model files discovered in the code.
- `packages/contracts/src/index.ts`, the server API/MCP/store implementation, `integrations/superhuman/pack.ts`, and `integrations/superhuman/agent-instructions.md`.

Older docs contain superseded defaults, counts and deployment instructions. Do not blindly follow them. Reconcile the latest follow-up sections with current code, inspect actual deployed behavior, and record mismatches. `live-agent-instructions.txt` is a historical snapshot unless its live contents have independently been confirmed.

Explain briefly, in your own words:

1. What the extension captures and how a tab becomes included.
2. What stays in browser storage, what syncs to the backend, and how retry works.
3. What Go generates and how read-only validation plus approved saving works.
4. How the saved map, practice bank, attempts and mastery relate.
5. What Send to Go actually does versus what requires the user's action.

Record the branch/commit, dirty files, extension installation/build path, backend identity/version when verifiable, connector endpoint/schema and selected release, live agent instruction status, browser version, permissions and test time. Verify the installation points to this checkout's `dist/extension`, not an older sibling checkout, and avoid duplicate active RabbitHole installations.

Current implementation expectations to verify, not assume:

- The latest connector source uses discovery query `schema=8`; that is not necessarily connector release number 8.
- Send to Go includes all pending captures. GetSession's twelve-capture read page is a transport boundary: Go follows all `nextOffset` pages in the same request. There is no six-capture processing cap. Existing total session, payload and analysis-size bounds still apply.
- Each rabbit hole remembers its own Go task/conversation; follow-up requests reuse it.
- New sessions enable trusted automatic selection capture by default. An explicit existing opt-out remains off.
- Shared session preferences are optional and off by default; switching them on applies the chosen preferences to existing and future rabbit holes.
- Practice is workspace-only; no Trail/Practice switch should appear in the side panel.
- Connection strength counts distinct visible captured article/highlight page URLs. Repeated highlights from the same page count once; queries and AI Overview outbound links do not count as independently captured page evidence. This is evidence breadth, not a truth probability.

If local code and live deployment differ, report exactly which version each result concerns. Do not call a local fix live-verified.

## 3. Build an inventory and run automated checks

Create a feature matrix before running through the UI. For each feature record the expected behavior, test method, scenario, result and evidence. Inspect code and existing tests to catch implemented features omitted from this prompt. Mark deferred roadmap ideas separately; they are not failed release requirements.

Run `npm run test:release`, which currently includes check/typecheck/unit tests/build, lint, packaged-browser suites, Stage 3 flow and extension-reload tests. Verify the script first. Run `git diff --check` and validate `integrations/superhuman/pack.ts` with the installed Coda CLI. Use the installed Chromium path documented in maintenance if the expected Playwright binary is absent; check that path still exists. Run browser suites sequentially to avoid confusing interference. Do not reinstall dependencies or change versions unnecessarily.

Report actual commands, exit codes and test counts, not historical counts copied from docs. Inspect generated screenshots and browser errors; a green process alone is not visual evaluation. Report test-harness failures separately from confirmed product bugs. If a failure is intermittent, preserve the first failure and the rerun outcome rather than reporting only the pass.

## 4. Establish genuine research scenarios

Use public, readable, explanatory sources and actual browsing actions. Choose topics you can independently evaluate, such as a small web application's architecture and GPU parallelism. Do not invent relationships before reading the sources.

Use three clearly identified test sessions:

**A. Substantive whole-trail session:** a coherent research goal, several related concepts, at least two actual explanatory article pages, meaningful selected passages, and more than twelve genuine pending captures before the first Go request. Count the real captures and inspect their actual text. Use a visible AI Overview if available; if unavailable, mark that subtest blocked rather than manufacturing one. This scenario tests pagination, initial generation, relationships and practice.

**B. Independent session:** a different subject, different goal/familiarity/preferences and its own Go conversation. Use it to test isolation, session switching and shared preferences. Make one genuine initial Go save if access permits.

**C. Sparse session:** only a search query or genuinely insufficient material. Expect honest interests/gaps and potentially no factual questions. Then collect explanatory source text and verify the same session can be enriched. A sparse map is not automatically a generation failure.

Plan a small number of meaningful Go runs: A initial generation, A incremental update, B initial generation, and targeted question-only/rebuild/sparse recovery checks as needed. Reuse sessions and results; do not repeatedly regenerate an already adequate bank just to test navigation.

## 5. Collection and session controls

Test all of the following with visible captured-text evidence:

- First-run setup, connection validation, website permission grant/denial and recovery. A refused permission should leave an understandable, recoverable state.
- Start from Google offer and from the side panel/workspace; goal, title and familiarity; resume versus new topic; Not now and persistent offer opt-out. Check trusted Enter/click handling and duplicate-submit protection.
- Automatic search-query capture separately from AI Overview content and references. Verify the actual summary is saved rather than just the query, adjacent organic results, hidden content, or fetched-but-unread references.
- Clicking a result in the same tab, opening a result in a child tab, and clicking quickly before the search's initial scan completes. The article must join the intended session and save readable explanatory text.
- Delayed/dynamic page content, reload, back/forward or client-side navigation when feasible, duplicate suppression and retry after a transient capture failure.
- Automatic trusted highlighting, explicit highlight shortcut/context menu, automatic-highlight opt-out, and important/confusing tags. Page-script-created selections and editable/input selections must not become automatic highlights.
- Article-capture off/on, meaningful extraction failure/fallback, and documented text bounds. Inspect that forms, editable fields and hidden/private content are excluded.
- Unrelated tabs, explicit Include tab, excluded pages/sites, restricted URLs and private browsing. Distinguish intended tab lineage from semantic relevance: the product does not infer perfect topical relevance.
- Pause/resume, finish, rename, switching sessions, reopening the workspace, and browser restart. Check that capture never silently attaches to the wrong session. Verify documented restart pause and re-inclusion behavior.
- Reading bunny: show/hide, drag/clamp, position persistence, theme contrast, pause/status feedback, opening panel/workspace and shortcuts. Hiding it must not pause capture. Test the workspace Back to side panel button through Chrome's real API, checking for the user-gesture error.

## 6. Sources, exclusions and persistence

- Inspect captured text, timestamps, source type, original links, new/processed indicators and capture lineage where exposed.
- Hide/unhide and bulk controls; important/confusing changes; delete; page/site exclusion and Manage list.
- Specifically reopen the ellipsis menu on a hidden find: the menu must remain readable and actionable so it can be unhidden.
- Hidden/deleted evidence should not be sent to Go or reappear in source-backed exports. Distinguish intended full-backup retention from user-visible learning exports.
- Verify deletion does not resurrect after refresh, queued retry or an upload whose response was lost. Use isolated fault injection for this case.
- Test local queue recovery after a genuine temporary disconnect, reload and controlled browser restart. Preserve captures, analysis and attempts. Never stop the production backend merely to test failure.
- Verify two sessions retain separate captures, analysis, attempts, pending states, task URLs and session-specific settings. Confirm ordinary refresh does not erase local practice state.

## 7. Go integration and data integrity

Follow the real workflow, observing tool calls/results where available:

- GetSession returns the intended session, current version, preferences, goal/familiarity, actual source text, stable short refs and pending metadata. Verify every pending page is read for session A, including captures beyond the first six and first twelve.
- Go creates one merged analysis across inspected pages. It uses exact source refs, validates, requests normal SaveValidatedAnalysis approval and obtains an actual saved version. Read the result back and compare the extension display. An opened chat, copied prompt, text-only claim or pending approval is not a saved result.
- Confirm first-pass selected activities for substantively supported main ideas and meaningful relationships across sources. Report whether generation unnecessarily stops, omits pages or drops earlier context.
- Incremental update preserves useful existing concept/question IDs and checked attempts, adds the newly inspected material, and does not erase the prior graph. Captures arriving after submission should remain new unless actually processed.
- Same-session send, Check/Open Go, missing-bank request, correction/feedback and rebuild reuse the linked Go task. Closing/reopening its tab still reuses its saved URL. Session B must use a different task. Test manually linking an existing valid task URL and rejecting an inappropriate host/path.
- Missing-bank requests use ValidateSessionQuestions with new questions and exact saved concepts, followed by approved saving. Existing map, questions and attempts must survive. It must not require retyping all source IDs or overwrite the map.
- Explicit rebuild can enrich an existing map without pretending old sources are new. Ordinary zero-pending processing should not make an unjustified write.
- In isolated tests, verify stale versions, unknown/deleted/hidden references, invalid answers and invalid quotations are rejected atomically with actionable diagnostics. Do not deliberately corrupt a personal session or weaken validation to make a save pass.
- Verify the sparse-source response is accurate: honest gaps and suggested next evidence, no fabricated source-backed explanations/quizzes. After genuine source capture, verify enrichment works without starting from scratch.
- Preserve and report exact tool errors. Distinguish connector discovery/version problems, model mistakes, approval denial, backend validation and insufficient evidence. Do not accept Go's explanation of a failure without checking available tool evidence.

## 8. Summary, map and evidence experience

- Summary answers the research goal where sources support it; main ideas, takeaways, route and gaps are coherent. Test next-search and targeted simpler/step-by-step/analogy/worked-example requests where exposed.
- Map/list toggle and persistence; pan/zoom/fit, search, layer controls, selection, keyboard/Escape, responsive drawer and Walk the route.
- Inspect every generated edge and its explanation. Confirm source/target, label direction, supporting citations and supported versus inferred/supplemental treatment. Hierarchy is not itself proof of a factual edge.
- Test a multi-branch map and a legitimately disconnected map. Do not require fictitious connections among unrelated subjects. Check that absent saved edges are clearly explained and do not produce a misleading single-depth line.
- Check clipping, overlaps, crossings, labels and fit at several viewport sizes. An intersection is not automatically a bug; assess whether the relationship can be followed unambiguously.
- Node details show appropriate claim, why, explanation, prerequisites, steps, example, boundary, takeaways, gaps and exact source excerpts when supplied. Links resolve to the cited sources.
- Per-node scroll position restores separately. Closing details must not briefly hide a node or replay a delayed entrance animation.
- Relationship strength has the correct distinct-page count. Repeated highlights on one URL, search queries and AI Overview outbound references must not inflate it. Hidden/deleted sources stop contributing; inferred status stays explicit regardless of count.

## 9. Practice mechanics and learning quality

Test both model correctness and the actual learning experience:

- Workspace-only hub, default All topics, main-ancestor topic assignment and legacy roots. Multi-topic questions count once in All topics. Verify every topic total, activity count and mastery-bar segment against actual questions/attempts.
- New lane: only untested items, basics first. Review: outstanding misses, variants when available, confident misses first. Harder: apply/transfer only and correct per-topic readiness filtering in All topics.
- Recompute readiness manually on a small known bank: every basic tried, at least 75% right without hints/guessing, no outstanding confident misses. Check exact lock reasons, boundary cases, and missing basics/harder items. Do not confuse a confident miss with general shakiness.
- Round sizes 5/8/12, Mixed and each available activity; disabled zero-count types; start button counts and actual round size; fewer eligible items than requested; no unintended repeats.
- Quiz selection/check/feedback and explanation of distractors, confidence preference on/off, hints, wrong-answer reasoning and feedback handoff.
- Matching checks/persists correctly; flashcards and open connection explanations clearly distinguish self-assessment from objective grading. Verify all available activity formats, not only quiz.
- Attempts save when checked, survive reload/refresh and reflect actual scoring/hint/confidence data. Unchecked selections must not silently become attempts or strengthen mastery.
- Topic/lane/activity switcher: popover dismissal, saved-answer counts, unchecked-pick warning, immediate switching, no unnecessary confirmation, and correct results/back-to-hub behavior.
- Harder offers use actual readiness numbers, never switch automatically, honor the global offer preference, and preserve Not yet until that topic's next round.
- No-analysis/disconnected, incomplete bank, loading/retry after eight seconds, exhausted topic/lane and results states. Correct missing-topic/lane requests and useful next actions. Do not use indefinite loading as a substitute for an empty state.
- Compare displayed mastery, confident misses and shaky state to independent calculations, including hint-assisted correctness, confident wrong answers, repeated attempts and successful variant recovery.

Evaluate the entire generated bank when manageable; otherwise state exactly what you sampled, reviewing at least twelve questions across topics/levels/types, all flagged mistakes, and every displayed edge. For each reviewed item assess:

1. Factual correctness and source grounding.
2. One defensible answer and clear wording.
3. Plausible distractors representing meaningful misconceptions.
4. Useful corrective explanations and non-giveaway hints.
5. Coverage of the important ideas rather than trivia.
6. Appropriate basic/apply/transfer progression and useful retry variants.
7. Whether success requires understanding rather than answer-length cues or memorizing repeated wording.

Perform a short learning walkthrough: answer before revealing feedback, make at least one deliberate confident error, inspect its correction, retry through Review, and attempt an unfamiliar application. Distinguish evidence that the mechanism works from evidence of long-term memorization: a short test cannot establish retention or educational efficacy. Give concrete strong/weak question examples, not only a score.

## 10. Settings, exports and completion states

**Settings:** test all five sections in workspace and panel, navigation/scroll tracking and restoration, immediate saving, modal focus trap, Escape/backdrop and return focus. Test Light/Dark/Follow system, map/list default, Google offer, exclusions, shortcuts link, round size, confidence, harder offers, connection card/editor and session controls. A saved token is never repopulated into an input; Replace reveals an empty field and Cancel preserves the working connection.

Test session-only preferences against shared preferences with sessions A/B and a newly created session. Change depth, analogy, activities and capture options; verify existing/future sessions update only as intended. Disable sharing and verify subsequent per-session edits are isolated. Test defaults with no session open and their use by both supported new-session flows. These tests must not unexpectedly change personal sessions: use an isolated profile for global-scope mutations if necessary.

**Exports:** inspect JSON backup, Anki CSV, Quizlet copy and Markdown/Obsidian output, correct escaping/newlines/Unicode, answers, source links/quotes and internal concept links. Check hidden/deleted evidence handling and that attempts/settings remain intact after export. Test a real third-party import when available; otherwise mark external import unverified. Do not claim an import/restore UI exists merely because JSON can be exported.

**Handoff states:** pending label/count/time/progress, Open Go and Cancel; saved counts and timestamp; detectable failed state/reason/retry/copy-details; stalled after ten minutes. Use isolated clock/fault fixtures for long waits and controlled failures, and label them accordingly. Do not invent a detectable failure when the extension cannot observe one.

Test notify/open/quiet modes: correct ready-note counts and placement in workspace/panel; twelve-second timeout paused on hover/focus; dismissal and Escape; Map unread dot lifetime; automatic Map opening only when the workspace is active, without stealing focus; failures still visible in quiet mode. Canceling a receipt must not delete finds or imply Go was canceled.

## 11. Accessibility, polish and release boundaries

Test light/dark/system themes, desktop, narrow workspace, side panel, zoomed text and reduced motion. Check keyboard-only completion of the main journey, visible focus, menu/switcher dismissal on outside pointer/focus/Escape, focus return, disabled controls, labels and status/alert announcements. Evaluate contrast and layout using measurements where practical, and explicitly state whether a screen reader was used.

Check top-bar overlap, long titles/topics, empty/large banks, scroll containment, readable source quotes, truncated text access, toast obstruction and accidental double actions. Identify confusing user-facing wording separately from technical errors.

Do not classify deferred features such as cross-session graphs, spaced/daily review, Google Déjà vu cards, predict-first route steps, additional activity formats or a Go MCP App receipt as release bugs. Do not promise autonomous Go invocation, guaranteed topical relevance, unsupported sidebar control, or measured learning outcomes.

## 12. Deliverables and decision

Write a report in `docs/release-evaluation-YYYY-MM-DD.md`, with screenshots/logs in a clearly named ignored test-results directory. Redact all sensitive content. Include:

1. A concise architecture/product explanation and exact versions tested.
2. A complete feature matrix: **PASS / FAIL / BLOCKED / NOT TESTED / NOT APPLICABLE**, test method and evidence. Keep automated fixtures, real installed-extension checks and real Go results distinct. Source review alone is not a runtime pass.
3. Automated commands/results, genuine test session IDs, capture/page counts, Go tool/version receipts and unresolved deployment differences.
4. Reproducible findings: severity, steps, expected versus actual, affected build, evidence, reproducibility and user/demo impact. Identify root-cause hypotheses as hypotheses.
5. Content-quality findings and examples, including source accuracy, relationship quality, question difficulty, distractors, feedback and coverage.
6. A judge-oriented usability assessment: can a first-time viewer understand the problem, the value of Go, the map's useful connection and the benefit of practice? Separate demonstrated benefits from claims needing longer study.
7. A prioritized list divided into **must fix before recording**, **small polish worth doing**, and **defer until after submission**. Prefer a short defensible list over speculative feature expansion.
8. A candid verdict: **READY TO FREEZE**, **READY AFTER SPECIFIC FIXES**, or **NOT READY**. Major untested live gates prevent an unconditional READY verdict; a blocked feature is not a pass. Minor documented limitations need not prevent recording if the core journey is reliable and represented honestly.

Recommend READY TO FREEZE only when the real capture → Go validation/approved save → evidence-linked map → useful practice → retained progress journey succeeds, the whole-trail/incremental/question-only paths work, session isolation and source integrity hold, and no unresolved critical/high-impact defects remain. State any remaining bounded limitations explicitly.

End with the exact manual actions I still need to perform and whether it is sensible to save a release checkpoint and move to video planning. You may identify proven demo-worthy moments and constraints, but stop before creating a storyboard, editing plan or new feature implementation.
