# Testing

## Automated checks

```sh
npm run check          # typecheck, tests/*.test.ts, production build
npm run lint           # Prettier checks
npx playwright install chromium
npm run test:release   # check, lint and all browser scripts
git diff --check
```

Set `CHROMIUM_PATH` to an installed Chromium executable if the Playwright-managed browser is unavailable:

```sh
CHROMIUM_PATH='/path/to/chromium' npm run test:release
```

| Script                        | Coverage                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `npm test`                    | Contract/model tests, rendered UI, worker failure/retry behaviour and authenticated MCP saves  |
| `tests/browser.ts`            | Packaged extension collection, scope, sync, offline recovery, map and practice                 |
| `tests/ui-refresh-browser.ts` | Map startup/revisions/perimeter, session history, Practice, Settings and notification fixtures |
| `tests/stage3-browser.ts`     | Search cards, source hide/delete recovery, explanations, practice persistence and exports      |
| `tests/content-reload.ts`     | Actual extension invalidation and stale content-script cleanup                                 |

`test:browser` runs the first two browser scripts; `test:stage3` and `test:reload` run the others. Browser scripts use built production code, temporary profiles and test-only pregranted permissions. Screenshots are generated under ignored `test-results/`. They do not test native permission dialogs, real Go instruction-following or generated teaching quality.

## Verified baseline

On October 29, 2026, the complete `test:release` gate exited 0 with **219/219 regression tests**, zero skips/failures, typecheck/build, formatting and all four browser scripts passing. Connector validation and `git diff --check` also passed. The map-startup regression reproduced missing handle bounds before the fix; ten focused cold starts passed afterward. The maintained browser suite checks startup, repeated reopen and question-only updates without refreshing the workspace.

These results describe the tested implementation, not a guarantee against all defects or a substitute for the live acceptance pass. Documentation consolidation does not alter application behaviour.

## Manual acceptance

Use intentionally collected public sources, the current deployed backend and the current extension build. Reload the extension and research tabs, confirm matching owner credentials in the extension/Go connector, and update live Instructions from [agent-instructions.md](../integrations/superhuman/agent-instructions.md). Keep Write approval at Always ask.

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

## Release validation

Confirm the intended backend commit is deployed, health succeeds, unauthenticated research requests fail and data survives restart. Recheck a genuine Go save/read-back and Practice after rollout. An unchanged schema 8 connector does not need a release for documentation, UI or instruction changes. Record live outcomes separately; fixture results cannot mark manual cases complete.
