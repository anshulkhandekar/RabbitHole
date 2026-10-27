# Stage 3 — October 27, 2026

Stage 3 responds to three problems found in daily use: forgetting to start a rabbit hole, no easy way to remove a find, and explanations that were hard to follow. It also borrows several learning ideas from the open-source LearnHarness project, paraphrased rather than copied.

## What changed

**Starting a rabbit hole from a search.** A card on Google results offers to start one when nothing is collecting, to resume a paused one, or to add the tab to the active one. If a search shares no topic words with the current session, it asks whether this is a new topic; starting the new one moves that search out of the old session. The card asks "What are you trying to figure out?" and how much the person already knows. It never captures without a click, ignores synthetic clicks, and is answered only for the search it was shown on. "Not now" quiets a tab for 30 minutes; "Don't ask" or the Settings checkbox turns it off.

**Managing finds.** Every find has a ⋯ menu: hide from map (reversible), mark important or confusing, never save this page or this site, and delete. Sources supports multi-select for bulk hide or delete. Hidden and deleted finds are withheld from `GetSession`, don't count as pending, and saves that cite them are rejected with the exact IDs. Deletions leave a server tombstone so a queued retry can't bring a find back. An idea whose sources are all gone says so and suggests a rebuild.

**Explanations.** The idea drawer now shows the fields Go was already writing but the V2 drawer dropped: example, boundary and per-idea takeaways. New optional fields give each idea a fixed shape: `claim` (one sentence), `why` (the problem that makes the idea necessary), `steps`, and `buildsOn` (earlier ideas it rests on). Gaps can carry a `nextSearch` chip that opens the search. "Still unclear?" hands a single idea to Go to explain more simply, step by step, with an analogy or with a worked example. The Go instructions were rewritten around this structure and a plain writing voice.

**Practice.** Quiz questions take an optional confidence before answering (Guessing / Think so / Sure). A sure miss is flagged as a confident miss and leads the next quick dig; a right answer that was a guess or needed a hint doesn't count as strong. Quiz feedback now shows why the picked option fails (`choiceExplanations` were saved but never shown). Quiz items can carry up to three `hints`, revealed one at a time. Items with `variantOf` are siblings used for retries, so "Review the ones you missed" asks the same idea in a new form. After a miss the person can say what made the wrong answer seem right; "Review my misses with Go" sends picks, confidence and reasoning to Go for targeted correction.

**Exports.** Anki CSV (front, back, source quote and link, tags), Quizlet copy (tab-separated), and Markdown for Obsidian with wikilinks between ideas. They're in Summary and Session preferences.

**Other.** The session goal appears at the top of Summary, with a "What your sources didn't answer" section. The React Flow credit moved off the top-left of the map, where it could sit on the root idea and block clicks; this was also what broke `tests/browser.ts`.

## Deploying

All new fields are optional, so existing saved maps still validate.

1. Push the branch and merge to `main`. Render redeploys the backend automatically.
2. Release a new connector version (release 7) pointing at `https://rabbithole-1c5e.onrender.com/mcp?schema=5`. The changed query string makes Go rediscover the tools; the server ignores it.
3. In a fresh Go chat, check that `ValidateSessionAnalysis` advertises `claim`, `why`, `steps`, `buildsOn`, `nextSearch`, `hints` and `variantOf`, and that `GetSession` mentions `removedCaptureIds`.
4. Paste the updated `integrations/superhuman/agent-instructions.md` into the agent's Instructions field, then copy what is live into `live-agent-instructions.txt`. The instructions grew from about 11.6k to 14.8k characters; if Go enforces a limit, shorten rule 5 first.
5. Rebuild the extension, reload it at `chrome://extensions`, and refresh open research tabs.

## Verification

- `npm run check`: typecheck, 75 tests and production build pass. Lint and `git diff --check` pass.
- `npm run test:browser` passes end to end in the packaged extension. It had been failing at the Stage 2 checkpoint: one assertion predated automatic search joining, and the map attribution blocked a node click.
- `npm run test:reload` passes.
- Isolated fixture screenshots checked the drawer, Sources menu, quiz confidence and hints, feedback in both themes, Summary gaps and exports, and the search card in both themes.

Not verified: a real Go run producing the new fields, live connector discovery after the release, the search card on live Google markup, and native Chrome behavior for the new card. Quality of Go's rewritten explanations has to be judged on real trails.

## Not done yet

Predict-first steps in Walk the route, Déjà vu recall cards on Google, an MCP App receipt inside Go, and the cross-session idea graph.
