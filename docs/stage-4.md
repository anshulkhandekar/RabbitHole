# Stage 4 — Practice, Settings and Go completion

## What changed

Practice stays in the full workspace. Its home groups questions under main map ideas (or root ideas on older maps), with deduplicated All topics totals, four-part mastery bars, activity counts, and New, Review misses and Harder lanes. New rounds start with basics and mix available activity types without repeating questions. Review uses question-family siblings and prioritizes confident misses; answering a sibling correctly clears the family's outstanding miss. Harder practice requires every basic tried, at least 75% right without hints or guessing, and no outstanding confident misses. The lock reason includes the actual counts. Offers are explicit, and dismissals survive refresh until that topic's next round.

The round header has a topic/lane switcher. Switching keeps checked attempts, discards unchecked picks, and starts the selected scope directly. Returning to Practice shows results when an answer was saved. Missing-bank requests name the missing topics and lanes and use the monitored rebuild handoff. No-analysis, disconnected, incomplete, loading/retry and exhausted states are covered. Activity types with no questions remain visible and disabled.

The workspace has direct Settings and side-panel buttons. Settings combines Appearance, Collection, Practice, Connection and Session on one scrolling page, with section tracking and scroll restoration. The panel uses the same content as a full-panel page with section chips. Theme, preferred map display, Google offer, completion behavior, round size, confidence and harder offers save immediately. Session defaults are copied into both local and queued server creation, including the Welcome flow. The connection editor is the only explicit save form: it never puts the saved token in an input, and replacing it starts with an empty field.

Handoffs retain waiting, saved, failed and ten-minute stalled receipts. A known deleted submitted find can fail the handoff; failures only visible inside Go are not guessed. Saved receipts include added-idea, added-question and submitted-find counts. Notify mode shows a quiet ready note that pauses its twelve-second timeout on hover/focus; open mode switches only an already-active workspace tab and otherwise notifies; quiet mode keeps the Map dot. Failure UI is shown in every mode. The unread-map marker survives another handoff. Side-panel ready notes sit above the trail, and waiting/failure content uses the footer.

Idea details restore each node's reading position. Menus dismiss on outside pointer/focus and Escape, with focus returned on Escape. The requested light/dark `--ink-3` values are applied. Labels on selected or sunk backgrounds use `--ink-2` where needed: the requested light `--ink-3` is 5.06:1 on the surface and 4.72:1 on paper, but only 4.43:1 on the sunk surface. No dependencies were added. All new stored fields are optional, and local practice state is preserved when server sessions refresh.

## Verification

- `npm run check` was run after each implementation step, covering typecheck, unit/UI/worker tests and production build.
- `npm run lint` and `git diff --check` were run.
- `npm run test:browser` includes the existing packaged-extension flow and `tests/ui-refresh-browser.ts`. This machine needs `CHROMIUM_PATH` pointing to its installed Chromium 1223 binary; Playwright's expected 1248 binary is absent.
- Synthetic light/dark screenshots are written to `test-results/ui-refresh-*.png`: hub/incomplete bank, round switcher, no analysis, disconnected, exhausted, loading, all five Settings sections in workspace/panel, connection editor, and ready/failed notes in both surfaces. Browser assertions cover Escape/outside dismissal, focus return, token replacement, quiet-mode dots, notification hover/focus pausing and active/inactive automatic opening.

Not verified: real Go generation, a real connector save rejection, native website-permission prompts, OS-level side-panel opening/focus behavior, or a full screen-reader audit. The specified `docs/design/ui-refresh/README.md`, PNGs and `.dc.html` files are absent from this checkout, so the implementation follows the written spec and existing tokens/components rather than a visual comparison with those references. No commit was created.

## Follow-up — Go conversation reuse, map interaction and question-only saves

Each rabbit hole now remembers its Go `/tasks/<chat-id>` conversation. Send, feedback, missing-question requests and Check Go reuse the associated tab and URL. The first Go tab is tracked until it becomes a task; later requests reopen that task if its tab was closed. URLs persist locally, while tab IDs remain browser-session scoped. Different rabbit holes retain separate associations. To attach a conversation created before this update, paste its URL into Settings → Session → Go conversation for this rabbit hole. Only task URLs on the configured Go host are accepted.

Hidden finds now dim only their content; the ellipsis menu remains fully readable and usable. Closing node details no longer restarts the row-delayed entrance animation. Maps with no saved relationships use a compact grid and explicitly say that no connections were saved; the app does not invent edges. Connected maps keep their source-depth layout.

Missing-question requests use the new read-only `ValidateSessionQuestions` MCP tool. Go submits only new question IDs, saved concept IDs, wording and answer keys. The server attaches canonical source IDs from the saved concepts, preserves the full existing guide and questions, validates the combined result, and returns the usual `SaveValidatedAnalysis` approval arguments. Stale versions, unknown concepts, overwritten question IDs, unavailable sources and invalid answer keys remain rejected. This removes the repeated full-map/source-ID transcription that failed in the live question-bank rebuild. Query-only interest/gap maps still cannot justify fabricated factual questions; collect article text or highlights when the saved explanations lack support.

Manual rollout: deploy the backend; build/release the connector with the current `integrations/superhuman/pack.ts` (`schema=7`); refresh the attached Go connection and paste the current instructions from `agent-instructions.md`; reload the extension. Git changes do not update the connector or live instructions automatically. Existing chat links can be preserved. The live instructions snapshot is not rewritten by this change.

Regression checks cover per-session task reuse and reopening, narrow question validation/save through authenticated MCP, preservation of the existing guide and progress, compact disconnected layouts, readable hidden-find menus, and node visibility immediately after closing details. Light/dark fixtures add `ui-refresh-hidden-find-menu-*` and `ui-refresh-unconnected-map-*`. Real Go completion with the new tool and native task URL tracking still require live verification after rollout.

## Follow-up — capture reliability, shared preferences and whole-trail processing

The workspace side-panel button calls Chrome directly during its click handler, using the tab's window ID loaded beforehand. It no longer waits for worker storage/tab lookups that discard the user gesture. Reading-widget messages retain the immediate worker path.

Settings › Session has “Use these preferences for all rabbit holes”. Turning it on copies the current depth, analogy, activities, article capture and automatic-highlight choices to every locally known session and new-session defaults. Changes continue to apply globally while it is on; server refreshes apply them to newly discovered sessions too. Turning it off leaves existing values intact and restores per-session editing. The stored scope flag is optional and defaults off.

Google capture recognizes visible AI Overview regions by label, semantic heading and answer-region attributes, with outbound references stored separately. Article extraction removes forms/editable and hidden elements, uses Readability, and falls back to readable main/article regions. DOM changes trigger scans without indefinite debounce postponement; failed saves retry instead of permanently marking the page captured. New article tabs inherit their included opener, including a Google search whose initial content scan has not run yet. Private and excluded pages remain excluded. New-session automatic selection capture defaults on; explicit existing opt-outs remain off. Trusted user selections are still required, and page scripts cannot manufacture automatic highlights.

Send to Go includes all currently pending finds. GetSession's twelve-item read page is a transport boundary, not a six-capture processing batch: Go is instructed to follow every pending page and submit one merged guide. The processed-ID contract accepts the full existing 300-capture session capacity. Selected practice activities and meaningful cross-source relationships are requested on the first substantive pass; unrelated topics are not forced together, and search-only interest maps still do not justify factual quizzes.

Connection evidence strength is derived locally from the distinct visible article/highlight page URLs cited by an edge. Repeated highlights on one page count once; search strings and AI Overview outbound citations do not inflate the metric. Line width reflects that count (capped visually at three pages), and selected labels, tooltips and details show the count. Inferences remain dashed and explicitly identified. This is evidence breadth, not a truth probability. Existing maps gain the metric without a migration; absent saved edges require Go to rebuild from actual explanatory sources.

Manual rollout: deploy the backend; build and release the connector from `integrations/superhuman/pack.ts` with `schema=8`; update the live agent instructions using `integrations/superhuman/agent-instructions.md`; refresh the Go connection; reload the built extension and any research tabs. Existing query-only captures cannot acquire the article or AI Overview text retroactively: revisit the source pages in an active included session. There is no need to delete the existing rabbit hole.

Verification covers article save retry, dynamically added text, AI Overview variants, private/excluded tab inheritance, whole-trail handoff and paged MCP reads, shared preferences and legacy explicit highlight opt-outs, and distinct-page relationship metrics. Packaged-browser fixtures exercise an AI Overview plus an actual article-link click, trusted highlighting, the native workspace side-panel button, shared Settings and light/dark connection metrics. Live Google DOM variants, live Go generation/approval, connector release selection, and native browser permission prompts still require the user's rollout test.

## Release fixes — October 28

Handoffs complete on a newer saved version and show the submitted finds still waiting. Practice assigns each question to one topic, including legacy orphan trees, and counts only original basics toward Harder readiness. Stale review POSTs keep their local attempts without blocking later sync; refresh preserves errors for requests still queued. Google topic switches remove every unprocessed capture from that search URL, and automatic enrollment respects tabs bound to another existing session. The existing included-opener inheritance remains covered.

Analogies uses a local text draft saved on blur, and preference patches merge against the latest local state. Evidence drawers show source links and an explicit missing-excerpt hint instead of page openings; cited highlights retain their text. Send-to-Go and the agent instructions require main ideas at the root, parent chains for details, and 1–3 exact excerpts per main idea and supported edge. No server/MCP schema changed; the connector revision remains 8.

Additional fixes coalesce unprocessed AI Overviews per tab/page/session using deletion tombstones, omit stylesheet-hidden text and obvious cookie/consent banners, capture Google queries immediately on initial load, remove Google exclusion actions from overview menus, correct the copied-prompt label, and remove nested Practice main landmarks. The Stage 3 browser harness honors CHROMIUM_PATH, starts rounds from the hub, and drains worker messages from an inert fixture page before seeding storage.

Remaining: F6 (save checked attempts before Continue), F9 (question top-ups with hidden/deleted sources), and the remaining F15 pluralization, hint-assisted result grouping and partial-matching switch warning. These need separate changes; existing behavior is retained. Relevance-aware tab inclusion, F12 model behavior, and F17 title/citation policy are unchanged.

Manual rollout: build the extension with npm run build and reload it at chrome://extensions, then reload research tabs. Update the live Go Instructions field from integrations/superhuman/agent-instructions.md. These fixes change no backend code or MCP tool schema, so no backend deploy or connector release is required. Keep Write approval at Always ask. Existing sessions remain usable.

Automated verification: npm run check (137 tests), npm run lint, git diff --check, and the full CHROMIUM_PATH-configured npm run test:release passed, including both browser suites, Stage 3 and reload.

Live verification is **not done**. After rollout, run a new session with at least 13 captures through Go and approved save; practise while a Go save lands; switch topics using the Google card; compare All topics with the sum of topic totals; and type “busy restaurant kitchens” in Analogies, blur it, then confirm it survives refresh alongside a quick depth change.

## Residual fixes — October 28

Settings saves pending Analogies drafts on Escape, backdrop and close-button dismissal. Coalesced overviews retain their search parent. Ready notes count only processed finds and use singular/plural wording. Harder readiness requires available questions; solid basics without them prompt a Go request. Results retries select Review, fragile correct answers have their own result group, and the switcher warns about unfinished matching progress.

Quiz and matching attempts now persist at check time, before network delivery; Continue, Enter and End advance without recording again. Attempt IDs are idempotent locally and remotely. Reasoning entered afterward updates the same attempt locally and on the server while its version is current; changed-version notes remain local. Note updates cannot alter the checked answer and survive refresh. Stale attempts carry optional browser-only localOnly metadata and a non-blocking explanation; they do not enter server attempt totals. The bunny defaults to the right edge at mid-height, checks underlying controls on initial page placement, and nudges clear without rewriting valid saved positions. Dragging and clamping remain supported.

Question-only validation uses visible evidence, excludes unsupported targets with actionable errors, and appends questions transactionally to the original guide so hidden sources remain recoverable. Approval still rechecks versions, sources and answer keys. Agent instructions and Send-to-Go now emphasize typically one main idea per independent subject, 2–3 siblings on the first substantive pass, and plausible misconception distractors.

Automated verification passed: npm run check (161/161 tests and build), the full CHROMIUM_PATH-configured npm run test:release (both browser suites, Stage 3 and reload), npm run lint, and git diff --check. Live verification of these residual changes is **not done**.

Rollout: merge the reviewed backend changes to main and deploy; build and reload this checkout's extension and research tabs; manually update the live Go Instructions field from rabbitv4-2/integrations/superhuman/agent-instructions.md. No server/MCP wire schema changed; schema remains 8 and no connector release is needed. Keep Write approval at Always ask. Re-run the ten live checks from the residual task, including immediate reload after checking an answer and a question top-up after hiding a source.

## Final residual fixes — October 28

Bunny overlap detection now samples the centre, edge midpoints and corners, and checks interactive-control rectangles, including small header buttons inside its footprint. Temporary nudges retain saved preferences and do not snap back on re-scans. Practice counters reflect durable local attempts before delivery finishes. Practice and Summary use singular count wording. Question-only approval failures caused by newly hidden/deleted sources request ValidateSessionQuestions again without suggesting captureIds edits or mutating data. Article extraction separates titles and blocks and avoids repeating an H1 that matches the title. MCP schema remains 8.

Live verification is **not done**. Remaining manual rollout and checks:

1. Merge to main and deploy the backend.
2. Reload the extension and research tabs.
3. Paste the live Instructions from rabbitv4-2/integrations/superhuman/agent-instructions.md.
4. Run one real Go generation to judge main-idea structure, siblings and distractors.
5. Run one real partial save or stale answer.
6. Check the bunny on real Google and Go pages.

## Approval identity and incremental evidence — October 28

Named rabbit holes keep their session titles across Go saves, including renames made after preflight. Only “New rabbit hole” adopts the first guide title automatically; the analysis retains Go's separate guide title. Incremental saves retain visible sources and verified quotes for the same question/answer key, including when hints or feedback improve. Hidden/deleted evidence stays excluded; changed questions do not inherit unrelated old quotes. Explicit rebuilds can intentionally replace citations, and citation limits remain enforced without silent truncation.

Validated saves reject mismatched session/title arguments without writing and return exact retry arguments only for the authenticated owner's live draft. Foreign, expired and unavailable drafts disclose no correction details. Go instructions require comparing the requested session ID before approval and copying saveArguments verbatim. The backend cannot prevent Go from displaying malformed arguments before receiving the write call; that remains a live client check. No tool schema changed; connector schema remains 8.

Deploy the backend, reload the extension/research tabs, and manually paste this checkout's agent instructions. Live verification remains **not done**. The final isolated audit prompt is in docs/final-testing-prompt-2026-10-28.md.

L1/L2 are fixed: deleted-find failures count only submitted finds still present and unprocessed (including hidden finds), and question top-ups distinguish unknown variantOf IDs from saved parents excluded by hidden/deleted sources; live verification remains pending, and L2 requires the backend deploy already listed above.
