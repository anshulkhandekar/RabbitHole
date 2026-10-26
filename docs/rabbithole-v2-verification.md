# RabbitHole v2 verification — October 25, 2026

Implemented in the extension source and built into `dist/extension`. The installed extension has **not** been reloaded or signed off against its real saved session.

## Checks performed

- `npm run check`: typecheck, complete unit/integration suite, production extension/server build.
- `npm run lint` and `git diff --check`.
- Source `tokens.css` compared byte-for-byte with the supplied v2 file.
- Forbidden token-reference/known old accent-hex scan: no matches in extension source or assets.
- A local HTTP harness loaded the actual built extension UI with an isolated adapter and the supplied **Starting Investing** fixture. It does not access extension storage, capture browsing, contact the backend, or hand anything to Go.
- Completed an eight-item Quick dig using only the keyboard in each theme: light 6/8, dark 7/8. Matching used Tab/Enter; explanations used Cmd+Enter; quiz and self-ratings used number keys; flashcards used Space.
- Verified feedback, results, memory tints, Summary counts, search `/` and Enter, route Right/Escape, and the 880px second-row tabs and bottom-sheet drawer. Selecting an idea keeps it above the sheet.
- The measured default desktop map had 9 cards, 11 merged connections, zoom approximately 0.992, and 13.5px card text (approximately 13.39px on screen). A sampled-path audit found no edge/card intersections. Focused label/card and label/label rectangle audits found no overlaps.

## §9 checklist

| Item                                                                     | Result in isolated built-UI fixture                                                           | Installed extension |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------- |
| Neutral palette in both themes; carrot reserved for attention            | Checked visually; neutral SVG and raster toolbar icons rebuilt                                | Not verified        |
| Readable default node labels, no overlapping cards or labels             | Checked; measured sizes, ELK depth partitions, world-space label collision pass               | Not verified        |
| Distinct attachment points and one drawn relationship per unordered pair | Implemented and regression tested; reverse relationships retain their identities and meanings | Not verified        |
| Full-width unselected map; at most 7 floating control groups             | Checked: ruler, search, layers, zoom group, Walk, count (6 groups)                            | Not verified        |
| Summary, takeaways and reading-route overview moved to Summary           | Checked; the map shows the explicitly requested guided Walk card only while touring           | Not verified        |
| Keyboard-only mixed run, immediate feedback, results update memory       | Completed in both themes; memory reflected on the map and Summary                             | Not verified        |

Remaining edge intersections use small transparent crossing gaps so painted strokes stay distinct. This is **not** a guarantee of a geometrically crossing-free embedding. If “no edges overlap” means zero path intersections rather than no painted overlap, that stricter interpretation remains unmet; ELK crossing minimization does not guarantee it.

## Verification limits

Browser security policy rejected access to Chrome's extension-management page. No workaround was used. Therefore the required installed-extension **Starting Investing** check, real backend review delivery, and reloading the user's installed extension remain unverified. `tests/browser.ts` was updated for v2 but was not executed during this pass.

Reduced-motion CSS overrides and zero-duration camera behavior are implemented. Runtime reduced-motion emulation was **not** checked; the local browser passes used the host's normal motion preference. The updated packaged-browser test retains reduced-motion coverage for a later permitted run.

The broad §1 grep still reports two **comments** inside the unchanged supplied token file (lines 3 and 5). These are historical palette words, not token definitions or colors. Removing them would violate the request to copy `tokens.css` as-is. The actual forbidden-token and old-hex scan is clean.

The initial redesign pass did not change server implementation, capture logic, privacy logic, or Go delivery logic. The user-requested October 25 follow-up below changes these paths explicitly. Shared contracts gained the requested optional fields; Go prompt text requests them. Memory remains a client derivation from existing attempts. Matching keeps the backend's checked final permutation and records slips in the existing response field; those slips drive client memory and partial feedback.

## Reproduce the safe preview

```sh
npm run build
node scripts/redesign-preview.mjs
```

Open [the isolated fixture](http://127.0.0.1:8766/index.html?workspace=1) or [the 880px fixture](http://127.0.0.1:8766/responsive.html). Reloading resets fixture attempts. These are previews of the built UI, not the installed extension.

## October 25 user-reported issues

- Hosted Go saves returned 422. The conversation reported invalid exact quotations; the approved and retried payloads also differed in capture IDs. Added read-only ValidateSessionAnalysis, actionable unknown-ID errors, and instructions to correct/revalidate before asking for write approval. Backend-only commit `392515e` passed 33 tests plus typecheck/build in an isolated copy and was pushed/deployed. Private connector v5 (discovery schema 3) was released; the live agent instructions were saved. Existing authentication and Always ask for writes are unchanged.
- Shared local handoff state replaces per-view receipts. The workspace and sidebar show Waiting for Go, poll for a saved version, and clear when that batch's captures are processed. A ten-minute wait becomes Check Go. No claim of observing Go's reasoning or approval state is made. Background alarms also refresh pending handoffs.
- New Google searches join the active collecting session automatically after an explicit start. Other pages still require inclusion or existing research-tab lineage. Excluded URLs, paused/finished sessions and private windows remain outside automatic enrollment. Browser restart pauses collection and clears automatic enrollment.
- Fixed stale workspace tab context and suppressed the empty-session onboarding hint when captures already exist.
- Reading indicator: theme-aware icon contrast, free dragging with normalized persisted position and viewport clamping, green saved pulse, waiting spinner, red sync/stalled status, neutral paused/not-included state, and reduced-motion CSS. Unrelated tabs receive indicator metadata without source extraction.
- Added shortcuts: Alt/Option+Shift+R side panel; M workspace; B toggle indicator; H existing highlight capture. Hide/show does not pause collection. Chrome shortcut conflicts still require a native manual check.
- Full working tree: 56 tests, typecheck/build and formatting passed. Browser fixture verified dark/light icon contrast, dragging, waiting spinner and sync-error dot. Real installed-extension reload and native shortcuts remain unverified because extension-management access is blocked. Reduced-motion runtime emulation remains unverified.

The backend changes are committed/deployed separately. Extension V2 and follow-up UI changes remain local in dist/extension and require reloading the installed unpacked extension and refreshing research pages.

A subsequent live check exposed Go refusing to reproduce the full JSON guide after preflight. Commit `db360f1` adds bounded temporary validated-draft references and the normal-approval SaveValidatedAnalysis tool; connector v6 uses schema 4. Exact isolated-commit verification passed 36 tests plus typecheck/build; the full V2 working tree passed 56 tests. Preflight in the real existing session first caught an invalid excerpt without another approval request, then returned valid:true after removing only that optional unverified excerpt while retaining the concept and guide. Final short-reference approval outcome is recorded below when observed.

Final live outcome: Render confirmed `db360f1` deployed successfully. Private connector v6 was released, SaveValidatedAnalysis was discovered and enabled, and Write remained Always ask. The existing Go conversation successfully read the stored captures afresh, validated a new guide, and displayed a Save Validated Analysis approval card containing only session ID, draft reference and title. Its title is “A staged plan for coding, system design, and AI-era interview preparation.” The normal final approval was left to the user; no saved version or completed persistence is claimed. Local proof is `docs/live-go-validated-approval.png` (ignored). Draft references expire after 30 minutes.

The final Google enrollment regression also verifies that opening the sidebar on a fresh search immediately reports it included, before content extraction begins. Final full-tree verification: 56 tests, typecheck/build and formatting pass. The installed extension still requires a manual reload and refreshed research tabs; native shortcut conflicts and runtime reduced-motion remain unverified.
