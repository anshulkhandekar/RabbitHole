# RabbitHole release evaluation — October 28, 2026

**Verdict: READY AFTER SPECIFIC FIXES.** The real journey works end to end on the live stack: captures from the installed extension reach the backend, Go reads every page of a trail longer than twelve captures, the read-only validation and approved save go through, and the extension then shows an evidence-linked map. Practice records progress, and incremental, question-only, sparse and enrichment runs all succeed. Four defects are visible in a demo or silently damage data, and should be fixed before recording.

Evidence lives in the ignored `test-results/release-eval-2026-10-28/` folder: logs, screenshots, Go transcripts, saved-session JSON and isolated tests. Your Render dashboard paths have been redacted, and no tokens appear anywhere.

## 1. What was tested

| Item                    | Value                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Checkout                | `rabbitv4-2`, branch `anshulkhandekar/rabbitv4-2`, HEAD `e3daed9`. The only dirty file was the untracked `docs/claude-testing-prompt.md`; this report is now a second one.                                                                                                                                                |
| Live backend            | Render deploys `main` = `a672d4f`, a merge commit whose tree is identical to `e3daed9`. `ValidateSessionQuestions` answered live, confirming the deployment contains it. `/health` exposes no version.                                                                                                                    |
| Connector               | `integrations/superhuman/pack.ts` uses `…/mcp?schema=8`; `npx coda validate` reported "Pack is valid". The released connector number isn't visible to me. Go called GetSession, ValidateSessionAnalysis, ValidateSessionQuestions (inferred from the result) and SaveValidatedAnalysis live. Write remained "Always ask". |
| Live agent instructions | Not read back. The behaviour seen (paging, short refs, an honest search-only map) matches the current `agent-instructions.md`.                                                                                                                                                                                            |
| Installed extension     | One installation, ID `klgldiik…`, loaded unpacked from `rabbitv4-2/dist/extension`, with http/https access granted. Rebuilding produced a byte-identical `dist/extension`, so the installed build equals HEAD.                                                                                                            |
| Browsers                | Your Chrome 156.0.8078.48, driven through Claude in Chrome. A scripted Chrome for Testing 148 window loaded the same `dist/extension` path (same extension ID) in a throwaway profile, connected to the live backend and Go; that profile has since been deleted.                                                         |
| Time                    | 2026-10-28, roughly 15:40–16:45 UTC                                                                                                                                                                                                                                                                                       |

**Why there are two browsers:** Claude in Chrome refuses `chrome://` and `chrome-extension://` pages. So:

- every capture behaviour (Google, AI Overview, articles, highlights, the bunny, offer cards) was exercised in **your real Chrome and real installation**;
- every check on extension pages (Sources, map, Practice, Settings, handoffs) used the **same build in the scripted window**, against the same live backend and Go.

The matrix marks which browser each result came from.

## 2. How it works (brief)

1. **Capture.** Starting a rabbit hole binds the current tab. Child tabs whose opener belongs to the session, and Google search tabs that become active while a session is collecting, join automatically. Other tabs need Include tab. The content script saves the search query, the visible AI Overview (with its outbound links stored separately), bounded Readability article text, and trusted text selections.
2. **Storage and sync.** Everything is saved first to `chrome.storage.local` and a retry queue. The worker flushes that queue on UI actions and on a one-minute alarm. Tab bindings live in `storage.session` and clear on browser restart, which pauses collection. The queue is strictly in order: one permanently failing request blocks every later one.
3. **Generation.** Go reads GetSession in pages of 12, using short refs, and builds one merged guide. ValidateSessionAnalysis checks it without writing anything and caches a 30-minute draft; SaveValidatedAnalysis then saves it after normal write approval. The server checks ownership, version, refs, hidden/deleted sources, exact quotations and hierarchy. A question-only request goes through ValidateSessionQuestions, which adds new questions to the saved map.
4. **Map, practice and progress.** The saved analysis holds ideas (with `main`/`parentId`), edges and questions. Attempts are stored per question with the analysis version and synced. Practice topics are the `main` ideas, and each question belongs to the topic its idea descends from. Mastery is computed in the browser from attempts.
5. **Send to Go.** It copies a session-specific prompt and opens or reuses that rabbit hole's Go conversation. **You** paste it, press send and approve the write; the extension only polls for the saved version.

## 3. Automated checks

| Command                                              | Exit  | Result                                                                                                                                                                                                          |
| ---------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CHROMIUM_PATH=<chromium-1223> npm run test:release` | **1** | typecheck ✓; **124/124** unit tests ✓; build ✓; lint ✓; `test:browser` (both suites) ✓; **`test:stage3` ✗**, so `test:reload` never ran                                                                         |
| `test:stage3`, run 1 (copy with `executablePath`)    | 1     | Failed at line 308. The fixture written straight into storage was overwritten by a worker transaction still in flight. Intermittent; a harness race.                                                            |
| `test:stage3`, run 2                                 | 1     | Failed deterministically at line 347: it waits for a `Quiz …` button from the Stage 3 Practice screen, which Stage 4 replaced. The suite is out of date, so its export and confidence-feedback steps never run. |
| `npm run test:reload`                                | 0     | PASS                                                                                                                                                                                                            |
| `git diff --check`                                   | 0     | clean                                                                                                                                                                                                           |
| `npx coda validate integrations/superhuman/pack.ts`  | 0     | Pack is valid                                                                                                                                                                                                   |
| Isolated `defects.test.ts`, `stuck-queue.test.ts`    | 0     | 6/6 reproduce the defects F2, F3, F9 and F10                                                                                                                                                                    |

Release-script problems are harness defects, not product bugs:

- `tests/stage3-browser.ts` ignores `CHROMIUM_PATH` (it hard-codes `channel: "chromium"`) and fails on this machine before testing anything.
- Its Practice assertions predate Stage 4.

## 4. Test sessions and Go receipts

| Session                          | ID             | Captures                                                                                             | Go runs (all in one conversation per session)                                                                                                   |
| -------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A, GPU parallelism (whole trail) | `25cba767-…f6` | 26 captured; 3 Render pages deleted and 1 hidden, leaving **22 pending across two GetSession pages** | v1: 22 processed, 0 pending · v2: question-only, +2 questions, map byte-identical · v3: incremental, +4 processed, 4 late arrivals left pending |
| B, HTTP caching (independent)    | `5477ee53-…86` | 8 (2 articles, 2 searches, 4 overviews)                                                              | v1: 7 of 8 processed; one duplicate overview left pending (this triggers F1)                                                                    |
| C, Rust borrowing (sparse)       | `4810e06c-…00` | 1 query (its overview hidden), then 2 Rust Book chapters and 1 highlight                             | v1: honest interest-and-gap map with 0 questions · v2: enrichment, v1 idea IDs kept, +4 ideas, +7 questions                                     |

Approvals were clicked only after checking that the card named the intended `RH-TEST` session. One card showed a **wrong session ID**, `25cba767-39af-4238-8f45-5032374464fa`, which spliced in the tail of the validation ID. I dismissed it, and Go retried with the correct ID. Your personal sessions weren't edited. Starting test sessions only paused sessions that were already paused, and shared preferences were never switched on in your profile.

## 5. Feature matrix

**Method key:**

| Key  | Meaning                                                     |
| ---- | ----------------------------------------------------------- |
| Auto | repository suite with fixtures                              |
| Ext  | your real installed extension in your Chrome                |
| TB   | same build in the scripted window, against the live backend |
| Go   | live Go run with approved save                              |
| Iso  | isolated test (in-memory store or local server)             |
| Code | source review only, not a runtime pass                      |

| Feature                                               | Expected behaviour                                     | Method                                        | Result                                | Evidence and notes                                                                                      |
| ----------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Install path and identity                             | one install, from this checkout                        | Ext                                           | PASS                                  | Chrome Secure Preferences; hash-identical dist                                                          |
| Connection setup and native permission                | save connection; website access granted                | TB (you entered the token and allowed access) | PASS                                  | `hostPermission: true`; token never shown                                                               |
| Permission refusal and recovery                       | understandable, recoverable state                      | —                                             | NOT TESTED                            |                                                                                                         |
| Start from side panel; goal and familiarity           | session created with both                              | Ext (you)                                     | PASS, note                            | Only one field exists ("What are you trying to figure out?"), saved as both title and goal              |
| Start from Google card (topic switch)                 | goal and familiarity; one session                      | Ext                                           | PASS                                  | A double-click created exactly one session                                                              |
| Google card "add" variant (Start new)                 | starts a session                                       | Ext                                           | PASS, note                            | This variant has no goal or familiarity fields, so the session has no goal                              |
| Not now / Don't ask; Google-offer setting             | quiets or disables the card                            | Auto                                          | PASS (fixture)                        | You switched the offer on before testing                                                                |
| Search-query capture                                  | query saved                                            | Ext                                           | PASS                                  |                                                                                                         |
| AI Overview capture                                   | the summary itself, refs kept separate                 | Ext                                           | PASS, **FAIL (F7)**                   | Real summaries (795–4,663 characters) with 2–13 refs, but a still-rendering overview is saved 2–3 times |
| Same-tab result click                                 | article joins the session                              | Ext                                           | PASS                                  | dev.to, Modal, datainterview                                                                            |
| Child-tab click                                       | article joins the session                              | Ext                                           | PASS                                  | UVA, AWS; captured once the tab is visible                                                              |
| Click before the initial scan                         | search and article both kept                           | Ext                                           | **FAIL (F13)**                        | A click about 1.7 s after load lost that search and its overview; the article was kept                  |
| Typed URL and in-site navigation                      | captured                                               | Ext                                           | PASS                                  | MDN, Rust Book, UVA "Next" link                                                                         |
| Trusted automatic highlight                           | saved with a note                                      | Ext                                           | PASS                                  | 6 highlights                                                                                            |
| Page-script and editable selections                   | ignored                                                | Ext                                           | PASS                                  | Script-made selection and Google search-box selection were not saved                                    |
| Alt+Shift+H, context menu, "confusing" menu           | manual highlight                                       | —                                             | NOT TESTED                            | Synthetic keys can't fire Chrome commands; native menus aren't scriptable                               |
| Article extraction quality                            | readable text; forms and hidden content excluded       | Ext                                           | **FAIL (F8)**                         | `display:none` help popup captured; cookie banner saved as the "article"; author promo leads dev.to     |
| Unrelated tabs and lineage                            | only intended tabs join                                | Ext                                           | **FAIL (F4)**                         | Render dashboard tabs joined A; an old Google tab of B joined C; A kept B's overviews                   |
| Exclusions (page/site, Manage list)                   | not saved                                              | Auto, Code                                    | PASS (fixture)                        | Not exercised live; exclusions are stored per browser and never synced (by design)                      |
| Private browsing, restricted URLs                     | excluded                                               | Auto, Code                                    | PASS (fixture)                        | `incognito: not_allowed`                                                                                |
| Pause/resume from bunny; status                       | collection stops and starts                            | Ext                                           | PASS                                  |                                                                                                         |
| Bunny show/hide, drag, position                       |                                                        | Ext                                           | PARTIAL                               | Visible and clickable; its saved position covers Google's account avatar                                |
| Back to side panel (real API)                         | no user-gesture error                                  | TB                                            | PASS                                  | No console or page errors                                                                               |
| Browser restart and offline queue recovery            | pause on restart; queue survives                       | Auto                                          | PASS (fixture)                        | Not repeated live                                                                                       |
| Hide/unhide; hidden-find menu                         | readable, actionable                                   | TB                                            | PASS                                  | Menu opacity 1; "Show on map again" offered; Escape returns focus                                       |
| Tags                                                  | applied to the right find                              | TB                                            | PASS                                  | Highlights correctly omit the exclude options                                                           |
| Delete and bulk delete                                | removed locally and on the server, no return           | TB                                            | PASS                                  | Confirmation text clear; deletions reached your Chrome's session after refresh                          |
| Deletion after a lost upload response                 | no resurrection                                        | Auto                                          | PASS (fixture)                        |                                                                                                         |
| Hidden/deleted excluded from Go and exports           | withheld                                               | Go, Iso                                       | PASS                                  | Hidden overview not in the handoff (22 finds); Go never cited it; exports clean                         |
| Session isolation (Go chats, settings)                | separate                                               | TB, Go                                        | PASS                                  | Three distinct `/tasks/` URLs; B's preferences didn't change A                                          |
| GetSession paging beyond 12                           | every page read                                        | Go                                            | PASS                                  | 22 pending, GetSession ×2, all 22 marked processed                                                      |
| Initial generation                                    | merged guide, validated, approved, read back           | Go                                            | PASS                                  | Extension showed v1 with exact counts                                                                   |
| Relationships across sources                          | meaningful edges                                       | Go                                            | PASS, with quality notes              | 4–5 edges per session; inferences labelled                                                              |
| Incremental update                                    | IDs and attempts kept; late arrivals pending           | Go                                            | PASS                                  | v3 kept every ID; 4 late finds stayed new                                                               |
| Question-only request (ValidateSessionQuestions)      | map and attempts kept                                  | Go                                            | PASS                                  | Concepts and edges byte-identical; 5 attempts kept                                                      |
| Question-only after hiding or deleting a cited source | still works                                            | Iso                                           | **FAIL (F9)**                         | Rejected; misleading or raw error                                                                       |
| Rebuild (explicit)                                    |                                                        | —                                             | NOT TESTED live                       |                                                                                                         |
| Sparse session                                        | honest interests and gaps; no invented quiz            | Go                                            | PASS                                  | 0 questions, gap plus next search                                                                       |
| Enrichment of the same session                        | builds on v1                                           | Go                                            | PASS                                  | v1 IDs kept                                                                                             |
| Conversation reuse                                    | same task each time                                    | TB, Go                                        | PASS                                  | Reused A's tab and URL twice; B and C got their own                                                     |
| Automatic task-URL tracking                           | records `/tasks/…`                                     | TB, Go                                        | PASS                                  | Recorded for B and C                                                                                    |
| Manual task linking and rejection                     | valid accepted; others rejected                        | TB                                            | PASS                                  | Wrong host, `/agents/`, and `http` all rejected                                                         |
| Rejections of stale/unknown/invalid input             | atomic, actionable                                     | Auto, Iso                                     | PASS                                  | 124 unit tests plus the D2 cases                                                                        |
| Handoff waiting → saved receipt                       | counts and time                                        | TB, Go                                        | PASS for A and C; **FAIL (F1)** for B | B stays "Waiting for Go…" after a successful save                                                       |
| Stalled after 10 minutes; failure states              |                                                        | Auto, Code                                    | PASS (fixture)                        | F1 makes a false "stalled" likely                                                                       |
| Ready note (notify mode)                              | ready-note content                                     | TB                                            | PASS                                  | "Go added 4 ideas and 7 questions from 3 new finds"                                                     |
| Open/quiet modes; 12-second pause; Map dot            |                                                        | Auto                                          | PASS (fixture)                        | Not exercised live                                                                                      |
| Summary content                                       | answers the goal                                       | TB                                            | PASS                                  | Goal shown; route; takeaways                                                                            |
| Map rendering and inferred styling                    |                                                        | TB                                            | PASS                                  | Depth label partly under the zoom controls                                                              |
| Idea drawer and source links                          | fields, links                                          | TB                                            | PASS, **FAIL (F11)**                  | Evidence fallback shows promo text when Go supplied no quotes                                           |
| Relationship strength                                 | distinct pages                                         | TB plus my own count                          | PASS                                  | All A edges show "2 source pages", matching my count                                                    |
| Node visible after closing details                    |                                                        | TB                                            | PASS                                  |                                                                                                         |
| Disconnected-map layout                               | "no connections saved"                                 | Auto                                          | PASS (fixture)                        | C v1 had 0 edges but I didn't screenshot it                                                             |
| Practice hub numbers                                  | match a hand calculation                               | TB, Iso                                       | PASS                                  | All topics and topic counts exact                                                                       |
| Topic assignment                                      | every question has a topic                             | TB, Go, Iso                                   | **FAIL (F2)**                         | A: 2 of 4 orphaned; C: 2 of 7 orphaned                                                                  |
| New / Review / Harder lanes                           | basics first; confident misses first; readiness lock   | TB                                            | PASS, **F10**                         | Review ordered q2 (confident) first; lock reason exact; variants counted as "new"                       |
| Quiz: confidence, hints, distractor reasons           |                                                        | TB                                            | PASS                                  | "Confident miss" plus why-wrong text                                                                    |
| Matching with slips                                   |                                                        | TB                                            | PASS                                  | Slip counted                                                                                            |
| Flashcard and connection items                        | self-rated                                             | —                                             | NOT TESTED live                       | Bank B has them; covered by fixtures                                                                    |
| Attempts saved when checked                           | survives reload                                        | TB                                            | **FAIL (F6)**                         | Saved only on Continue; a checked matching answer was lost on reload                                    |
| Switcher                                              | immediate; checked answers kept; warns about unchecked | TB                                            | PASS, minor gap                       | No warning that the partial matching pick is discarded                                                  |
| Session/shared preferences                            | session-only edits isolated                            | TB                                            | PASS, **FAIL (F5)**                   | Isolated correctly; the Analogies field drops typed characters; rapid edits overwrite each other        |
| Shared preferences on                                 | applies to all sessions                                | Auto, Code                                    | PASS (fixture)                        | Not switched on live, to protect your sessions                                                          |
| Settings modal: focus trap, Escape, focus return      |                                                        | TB                                            | PASS                                  | 40 Tab presses stayed inside                                                                            |
| Token never placed back in an input                   |                                                        | Auto                                          | PASS (fixture)                        |                                                                                                         |
| Workspace-only Practice                               | none in the side panel                                 | TB                                            | PASS                                  | 360 px, no horizontal overflow                                                                          |
| Exports: Anki, Quizlet, Markdown                      | escaping, links, no hidden data                        | Iso (real session data)                       | PASS                                  | UI download buttons only covered by the broken stage3 suite; real third-party import NOT TESTED         |
| JSON backup                                           |                                                        | —                                             | NOT TESTED                            |                                                                                                         |
| Accessibility: screen reader, reduced motion, zoom    |                                                        | —                                             | NOT TESTED                            | No screen reader used; two nested `<main>` elements in Practice                                         |

## 6. Findings

Build: HEAD `e3daed9` (identical to live `main`) unless noted.

### Must fix before recording

**F1 — High. A successful save can stay "Waiting for Go…" and later become "stalled".**

- **Where:** `handoff-model.ts:13-16` requires every submitted find to be processed.
- **What happened:** in B, Go processed 7 of 8 finds (it skipped a duplicate overview) and saved v1. Eight minutes later the workspace still said "Waiting for Go… 8 finds sent 8 minutes ago", directly above the new 9-question bank. It never showed the ready note.
- **Expected:** the receipt completes when a newer version saves, and reports how many finds remain pending.
- **Reproducibility:** whenever Go leaves any submitted find unprocessed. F7 makes that common.
- **Demo impact:** a high-visibility moment that contradicts what Go just told the user.

**F2 — High. Practice topics leave questions out.**

- **Where:** `practice-model.ts` `practiceHub`. Topics are only the `main` ideas; a question belongs to a topic only if its idea descends from that main idea.
- **What happened:** in A, Go marked one idea main and left four ideas without a parent, so All topics = 4 but SIMT warps = 2. The hub said "Harder questions exist for 0 topics" although apply and transfer questions existed, and those can never unlock. The missing-questions prompt didn't mention them. C reproduced it with a main idea nested under a non-main root (7 vs 5).
- **Hypothesis:** the hub should fall back to tree roots or attach unparented ideas to a topic, and the Go instructions should require `parentId` under the main idea. B, which Go gave a proper hierarchy, was correct.

**F3 — High. One stale answer silently blocks all syncing.**

- **Where:** `background.ts` `flush` stops on any non-404 error; the server rejects a review whose `analysisVersion` isn't current.
- **What happened (Iso):** after Go saves version N+1, an answer recorded against version N gets a 409. Everything queued behind it never syncs — renames here; captures would be stuck the same way. The next successful refresh **clears the error message**.
- **Trigger:** answering a question shortly before the extension notices a new Go save, which is normal while practising during a handoff.
- **Hypothesis:** drop or rebase stale reviews (the attempt stays local), or don't let one failed item block unrelated ones.

**F4 — High. Captures attach to the wrong session.**

1. A topic switch from the Google card moves only the search capture. The same search's three AI Overview captures stayed pending in A, so A's next run would get HTTP-caching material.
2. Automatic search-joining (`enrollSearch`) re-binds any active, visible Google results tab to the current session. Five seconds after C started, B's open "stale-while-revalidate" tab was captured into C.
3. A tab inheriting inclusion captured three Render dashboard pages, including an environment-variables page, into A. Only the cookie banner was extracted, but the URLs and service IDs were stored.

**F5 — High if Settings is demoed, otherwise Medium. The session preference fields lose input.**

- **Where:** `Settings.tsx:115-118` builds `{...settings, ...value}` from stale props and saves on every keystroke.
- **What happened:** typing "busy restaurant kitchens" at 60 ms per key left "bya" in the field and stored "ues". Changing depth and then analogy quickly lost the depth change.

**F11 — Medium; visible in the demo. Evidence fallback shows junk.**

- **What happened:** when Go supplies no exact excerpts (all of A, all of C), "Why it's on your map" and "Where you read it" show the first 180 characters of the capture. For A's core ideas that was a self-promotion paragraph ("Hello, I'm Shrijith. I'm building git-lrc…").
- **Fix options:** require excerpts in the Send-to-Go prompt (the Rebuild prompt already asks), and stop the fallback from showing raw page openings.

### Small polish worth doing

| ID  | Severity     | Finding                                                                                                                                                                                                                                                                                                      |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F6  | Medium       | Checked answers are only written on Continue, Enter or End round (`Practice.tsx:326-340`), so closing or reloading after checking loses them.                                                                                                                                                                |
| F7  | Medium       | A still-rendering AI Overview is saved as 2–3 near-duplicates (5 extra in A, 3 in B). This inflates pending counts and Go's input, and causes F1. Keep the latest version per search.                                                                                                                        |
| F8  | Medium       | Extraction checks only inline `style.display` (`capture-model.ts:8`). Stylesheet-hidden content (mdBook's help popup) is captured; a cookie banner was saved as the article; site boilerplate leads the text. The 12,000-character cap cut off both Rust Book chapters (documented, but it affects quality). |
| F9  | Medium       | After a cited source is hidden, ValidateSessionQuestions rejects with "Remove them from captureIds…", which the tool doesn't accept as input. After an idea's only source is deleted, it fails with a raw validation error.                                                                                  |
| F10 | Medium-low   | Retry variants appear in "New questions" and count towards Harder readiness, so a learner must answer re-worded duplicates of questions they already got right. With no variants (A, first pass), Review re-asks the identical question with the same choice order.                                          |
| F12 | Low–Medium   | **Model behaviour:** Go put a corrupted session ID on one SaveValidatedAnalysis card. The server's owner/session checks make this safe, but a user approving blindly would get a failure.                                                                                                                    |
| F13 | Low–Medium   | Clicking a result about 1.7 s after a search loads loses that search and its AI Overview.                                                                                                                                                                                                                    |
| F14 | Low          | The ⋯ menu on an AI Overview offers "Never save www.google.com", which would silently stop all search capture.                                                                                                                                                                                               |
| F15 | Low          | Wording: the toast says "Prompt sent to Go" when the prompt was only copied and the tab opened. "1 answers saved", "1 checked answers", "1 main ideas". A hint-assisted answer is listed under "Got brighter". The switcher doesn't warn about discarding unchecked progress.                                |
| F16 | Low          | Layout and accessibility: the bunny's saved position covers Google's account avatar; the map's depth label sits partly under the zoom controls; Practice nests two `<main>` landmarks.                                                                                                                       |
| F17 | Low          | Each Go save replaces the user's session title with Go's title. An incremental pass also narrowed the citations on two existing questions without telling the user.                                                                                                                                          |
| H1  | Test harness | `test:stage3` ignores `CHROMIUM_PATH`, is out of date for Stage 4, and races its storage seeding. So `npm run test:release` can't pass here, and `test:reload` never runs inside it.                                                                                                                         |

### Defer until after submission

- Cross-session graphs, spaced review, Déjà vu cards, predict-first route steps, a Go MCP App receipt.
- Smarter, relevance-aware tab inclusion beyond fixing F4.
- A sync design that doesn't depend on queue order (beyond the narrow F3 fix).
- Syncing exclusions across devices.
- A JSON import/restore UI. Export only exists today; no import is claimed.

## 7. Content quality

I reviewed all 24 saved questions (A: 8, B: 9, C: 7) and every one of the 13 edges.

- **Factual accuracy: good.** No incorrect claims found. Examples: warp-switching latency hiding; max-age freshness; 304 revalidation; immutable borrows ending before a mutable borrow.
- **Grounding:**
  - B carries exact quotes; A and C carry none (F11).
  - A cited the UVA page's dubious "128 threads per SM" figure only implicitly, and never stated it as fact.
  - Inferred edges are labelled (A e4, C borrowing → lifetimes).
- **Relationships: meaningful.**
  - Warps → divergence ("shared control makes branch splits costly") and warps → coalescing are real mechanisms linking different sources.
  - B's chain scope → policy → freshness → ETag → trade-offs is coherent.
  - Edge direction is correct throughout.
- **Strong questions:**
  - C `quiz_aliasing_rule`: four plausible misconceptions, including "immutable reads cannot conflict with writes".
  - A `q1_harder`: two kernels with uniform vs split branches; requires understanding, not recall.
  - B `q_etag_variant`: validator mismatch.
- **Weak questions:**
  - A `q2` has throwaway distractors ("Idle.", "Repeat Warp 0.", "Move Warp 0 to the CPU.") and its second hint gives the answer away.
  - A `q3` includes "GPUs cannot add floats."
  - B `q_etag` includes "404 Not Found." and "Delete the response."
  - The correct option is often the most complete-sounding one, a mild length cue.
- **Coverage and progression:**
  - A's first pass was thin: 4 questions for 22 sources, divergence with no question, and no variants until the question-only request.
  - B and C had basic/apply/transfer levels plus variants.
  - Some "variants" test a different idea or level rather than re-wording the original (A `q1_review_variant2`).
- **Learning walkthrough:**
  - I answered before seeing feedback, made one confident miss (q2, plus a reasoning note), answered q3 correctly after a hint, and retried the miss through Review.
  - The mechanics work: the confident miss was flagged and cleared; the hint-assisted answer was "not strong"; mastery bars matched my calculation.
  - This shows the **mechanism** works. It says nothing about long-term retention or learning gains.

## 8. Judge-facing usability

- **Problem and value.** A viewer can follow the story: research in the browser, one "Send to Go", approve, and return to a map whose edges cite the pages you read, with evidence counts. The sparse-session result (an honest "questions to investigate" map) is a strong, credible moment.
- **Confusing parts:**
  - The paste-and-send step.
  - The "Prompt sent to Go" wording (nothing has been sent).
  - F1's lingering "Waiting for Go…".
  - Promo text as evidence (F11).
  - "Harder questions exist for 0 topics" (F2).
- **Demonstrated:** capture fidelity for searches, overviews, articles and highlights; whole-trail merging; incremental updates that preserve IDs and attempts; a question-only top-up; confidence-aware practice.
- **Needs longer study before claiming:** better retention or understanding, consistent question quality across topics, relevance of automatically joined tabs.

## 9. Decision and next actions

Freeze after fixing **F1, F2, F3, F4 (at least items 1–2), F5, and F11** (the prompt-and-fallback part). Each is bounded:

- receipt completion;
- topic fallback;
- the stale-review queue;
- moving or ignoring a switched search's overviews and not re-binding tabs owned by another session;
- local edit state for preferences;
- requiring excerpts.

Then re-run:

- a short live loop: one new session with 13 or more captures; Send; approve; practise during a Go save;
- the hub check;
- `npm run test:release` once H1 is fixed.

F6–F10 are worthwhile if time allows; F12 is a Go-instruction note.

**Manual actions for you:**

1. Decide whether to keep or delete the `RH-TEST` sessions:
   - A, `25cba767…`, retitled "GPU Parallelism: …";
   - B, `5477ee53…`;
   - C, `4810e06c…`.

   They stay in your extension and on the backend. A still contains B's three HTTP-caching overviews as pending finds (F4). C is the paused, active session in your Chrome.

2. Your previously active personal session is still paused. Resume it from the side panel if you were using it.
3. "Offer to start a rabbit hole when I search Google" is now **on** (you switched it on for this test); switch it back off if you prefer.
4. Optional: delete the three test Go conversations (`/tasks/315356db…`, `/tasks/7f67d8d4…`, `/tasks/b1b4f23e…`).
5. Optional: rotate the backend token. It was only entered into a throwaway profile that has since been deleted.

A release checkpoint and video planning should wait until the must-fix items are verified on live `main`.
