# Final release and manual rehearsal

Use `/Users/anshulkhandekar/RabbitHole/rabbitv4-2`, branch `anshulkhandekar/rabbitv4-2`. Preserve existing research and configuration. Automated results are in [status](status.md); everything below remains manual until actually observed.

## Before the final user pass

1. Confirm which backend commit Render is running. Earlier server fixes require a backend deploy; the latest Practice/map/history/documentation batch adds no server changes. If required fixes are absent, deploy the reviewed backend before diagnosing live behaviour.
2. Build this checkout, reload RabbitHole at `chrome://extensions`, and refresh research and Go tabs. Keep the same saved credentials and sessions.
3. Paste Instructions from `rabbitv4-2/integrations/superhuman/agent-instructions.md` into the live Go builder and save. Keep Write Always ask. Schema remains 8; do not release an unchanged connector just to update instructions.

## Real-user acceptance

| Journey                     | Check                                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh collection            | Start a named public-source session; collect 13+ searches/articles/highlights, including same-tab back/result navigation and a child tab. Confirm titles/text and an empty sync queue over several refresh cycles.                          |
| Collection controls         | Pause/resume on an unincluded page; Include tab scans without refreshing. Hide/show bunny, move it, check Google/Go controls stay accessible, and use Article saved → Undo. Deleted finds must stay deleted.                                |
| Preferences                 | Type a full Analogy, Escape, reopen; verify the text and a quick depth change both persisted.                                                                                                                                               |
| Real Go run                 | Send, paste and inspect GetSession pagination, corrected preflight if needed and the approval card's exact session/title. Approve only the intended write. Check actual saved version and remaining-find wording.                           |
| Guide quality               | Read one main idea and detail, one supported edge and one inference. Check exact-source relevance, mechanisms, limits and honest gaps. No fake connections or absurd distractors.                                                           |
| Practice clarity            | Topic totals reconcile. Unanswered original questions, reserved retries and ready medium/hard questions have distinct counts. Request a chosen number/difficulty of new questions; inspect the result.                                      |
| Persistence and concurrency | Check an answer, reload before Continue and confirm it exists. Practise while Go saves a new version; a stale answer stays device-only with a note and later captures still sync. Alternatively verify a real partial save's pending count. |
| Review and switching        | Retry misses shows Review. Hint-assisted/guessed correct answers are not “Got brighter”. Partial matching or an unchecked quiz choice warns before switching.                                                                               |
| Hidden evidence             | Hide a cited source and top up questions. The save succeeds only for visible supported targets; unhide restores the original guide evidence. An unsupported target gives an actionable error, without a partial write.                      |
| Map/history                 | Question-only v1→v2→v3 updates retain all connections without reload. Inspect drawer formatting, pan far and release, zoom/fit/keyboard navigation. Session dates remain original; recent sessions move up; previews scroll after eight.    |
| Recovery                    | Brief offline capture/online retry, browser restart/resume, failed handoff actions and source deletion behave honestly. Export contains no token.                                                                                           |

Record what actually happened, including approvals, errors and content weaknesses. Do not mark a live case passed from a fixture test. If a defect appears, preserve its error, session/version and reproduction before making a targeted fix.

## Commit and rollout — owner actions

1. Review `git status --short`, `git diff --stat`, the full diff and intended new regression/docs files. Keep `.env`, data, test-results, dist and node_modules ignored. Do not run a broad clean or delete the installed `dist/extension`.
2. Run `npm run test:release` with your Chromium executable, then `git diff --check`. Review production and full dependency audit results separately if refreshing them.
3. Commit the reviewed source/tests/docs, merge to main and deploy the backend. Check health, unauthorized access rejection and saved data persistence. Confirm the deployed commit, rather than assuming a merge has finished deploying.
4. Reload the built extension and research tabs. Reapply live Instructions from this checkout if not already current. No connector release is needed unless its actual tool schema changes; it remains schema 8 here.
5. Repeat a short genuine Go save/read-back and Practice smoke check against the final deployed version.
6. Record and edit the demo, check submission requirements and viewing access, then add real feature GIFs/captions to the README. See [demo](demo.md).

No automatic commit, deployment, publishing or live Go configuration is part of the local test pass.
