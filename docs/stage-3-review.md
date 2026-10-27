# Independent Stage 3 review — October 27, 2026

**Historical review before fixes.** The issues below have since been addressed in this workspace. See [the current test build and verification instructions](stage-3-ready.md). The original probes are now maintained as `tests/stage3-regressions.test.ts` and `tests/stage3-browser.ts`, and the regressions are part of the release checks.

Reviewed Claude's 26 changed/new files from the uncommitted `rabbitv4` worktree at base `9dc43b1`. Copied that snapshot into `rabbitv4-2` to run checks without modifying the original. No product fixes, commits, pushes, deployment, connector releases, or installed-extension changes were made.

Recommendation: address the source-removal and deletion problems before release. Passing the original unit suite does not cover these cases.

## Findings

1. **P1 — GetSession still exposes quotations from hidden/deleted sources.** `apps/server/src/store.ts:185` spreads the complete session, including its saved analysis, before replacing only the top-level captures. Existing `concepts[].evidence`, edge evidence and study evidence survive. Saving a guide with a quotation and then hiding or deleting its capture leaves that quotation in `batch().analysis`, which is returned to Go. The claim that Go never sees removed sources is therefore false for already analyzed sources. Filter withheld evidence throughout the returned analysis; do not rely on a textual instruction alongside the leaked quotation. Regression cases cover both hide and delete.

2. **P1 — A failed capture response can make deletion disappear without reaching the server.** `apps/extension/src/background.ts:178–184` treats every queued POST as unsent and skips DELETE if one exists. A queued POST may already have committed remotely and be awaiting retry because its response failed. Browser probe: the local backend commits the capture and returns 503; delete the local find; refresh. The exact same capture ID reappears from the server. Always deliver an idempotent deletion/tombstone even when cancelling an uncertain POST.

3. **P2 — Deleted searches are automatically saved again.** The content script sends the current search on each scan (`content.ts:139`), creating a fresh UUID each time. Deduplication in `background.ts:356` considers only remaining captures; deleted IDs in `session.removed` cannot match fresh IDs. Browser probe: delete the current Google search, dispatch the normal refresh event, and wait 2.5 seconds. The search returns with a different ID. Suppress automatic recapture of the deleted source on the current page, while allowing an explicit user action to save it again. The same issue can affect articles after a page reload.

4. **P2 — Export evidence filtering is inconsistent with source removal.** `apps/extension/src/export-model.ts:20` chooses Anki source receipts without checking hidden IDs. Markdown emits every saved concept quotation at line 136, even when its source is hidden or deleted; only the final Sources list applies filtering. Hidden evidence appears in both tested formats. Deleted evidence also remains in the saved analysis used by the Markdown path. Use the same visibility check for receipts and quotations and select an alternative visible source when available.

5. **P2 — Rebuild cannot recover after deleting all previously processed sources.** `apps/server/src/store.ts:337` requires `s.processed.length > 0`, but source deletion now empties that array. Reproduction: save the original guide, delete its sole source, capture a replacement, validate an otherwise valid rebuild citing/processing the replacement. It fails with “Rebuild requires an existing saved analysis” even though analysis exists. The UI specifically recommends rebuilding after removing sources. An ordinary incremental save is a possible workaround, but the explicit rebuild path must also work.

6. **P2 — Enter cannot submit the search card's goal field.** `apps/extension/src/content.ts:421` calls `first.click()` for Enter, while the button handler rejects events with `isTrusted === false`. Programmatic `.click()` is untrusted even when invoked from a trusted key event. Real-browser fixture: fill the goal, press Enter → zero `search-accept` messages; click Start → one. Invoke the shared action from the trusted key event instead of manufacturing a click.

## Verification results

| Check                                                   | Result                                                                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check` on Claude's snapshot                    | Passed: typecheck, 75/75 unit tests, production build                                                                            |
| `npm run lint` and `git diff --check`                   | Passed on snapshot                                                                                                               |
| `npm run test:reload`                                   | Passed in packaged Chromium extension                                                                                            |
| Original `npm run test:browser`                         | Failed twice at `tests/browser.ts:545`: drawer missing after resizing to 880px and clicking root idea                            |
| Temporary full browser suite with 1.2s post-resize wait | Passed all remaining end-to-end checks, including light/dark and narrow layouts                                                  |
| Local official MCP client at `/mcp?schema=5`            | Passed discovery of claim, why, steps, buildsOn, nextSearch, hints, variantOf; GetSession description includes removedCaptureIds |
| `node --import tsx --test tests/stage3-review.ts`       | Five expected failures exposing findings 1, 4 and 5                                                                              |
| `node --import tsx tests/stage3-review-browser.ts`      | Probes reproduce findings 2, 3 and 6                                                                                             |

The original browser failure is timing-sensitive: inserting a settling delay after `setViewportSize` lets the rest pass. This does not establish a new product regression. Replace the delay with a condition that waits for the layout to settle before claiming the unchanged browser suite passes. The original suite was left unchanged.

The matching Playwright Chromium binary was initially absent. Downloaded it to `/private/tmp/rabbithole-review-browsers`, using Playwright's documented custom browser path. For browser checks above, prefix commands with `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/rabbithole-review-browsers`. The browsers used isolated temporary profiles and synthetic pages. No personal research data was loaded.

The added regression file intentionally has no `.test.ts` suffix, so the existing default unit suite remains independently runnable. Its failures must not be mistaken for a passing release gate. The temporary full-suite copy was removed; the original and adjusted-run logs are in `/private/tmp/rabbithole-review-browser-rerun.log` and `/private/tmp/rabbithole-review-browser-settled.log`.

## Claim coverage and remaining limits

The implementation and passing tests cover session goal/familiarity, search offers and opt-out, source hide/tag/delete ownership, validation rejection of withheld citations, new explanation fields, per-option quiz feedback, confidence/hints/notes, retry selection, and export serialization. The browser suite covers the existing packaged-extension workflows and responsive themes; the new browser probes exercise actual capture and sync behavior plus a synthetic search-card keyboard fixture.

`integrations/superhuman/pack.ts` still points at `schema=4`, and `live-agent-instructions.txt` still records the older prompt. These agree with Claude's statement that the live release/update remains undone, rather than proving the new connector is active. Local schema discovery passed; live Go discovery, approval behavior, actual generated explanation quality, live Google markup, native Chrome permission prompts, and Anki/Quizlet/Obsidian imports remain unverified. No external services were changed.

Predict-first route steps, Deja vu cards, the interactive map in Go, and a cross-session graph remain unimplemented as documented. A paraphrased instruction file alone does not establish provenance or licensing of any external inspiration; no LearnHarness source comparison was part of this review.
