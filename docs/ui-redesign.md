# RabbitHole UI redesign verification

The redesign follows `/Users/anshulkhandekar/ai-toolkit/smoke-test/rabbithole-design/README.md`, in its foundation → side panel → workspace → map → practice → motion/responsive order. Both HTTP-served prototypes were inspected. Fixture text was used only as a design reference; `data.js` is not included in the product. `FUTURE.md` was not read or implemented.

## Implemented

- Supplied tokens are preserved byte for byte at `apps/extension/src/styles/tokens.css`. Shared component styles, SVG icons and the supplied brand mark replace glyph icons. All four supplied PNG sizes are copied into both manifest icon mappings.
- Geologica and Literata are packaged as local variable WOFF2 assets, with their OFL licenses. The build strips the prototype’s Google Fonts import from its output while retaining the original token source unchanged. Literata is reserved for literal captured quotations.
- The side panel has a session switcher, scoped capture controls, contextual include/exclude, chronological descending trail, depth count and pinned Go footer. It reports the actual number of included tabs rather than assuming all included tabs came from an opener.
- Ready and Updated footers have one primary action. Handoff has the actual copied/opened result, selectable prompt, numbered instructions and Cancel, without a pretend processing indicator. A saved version observed through polling is required for Updated. A session with no captures does not claim a map exists.
- Workspace has the session rail, depth bars, segmented Map/Practice/Sources, inspector, contextual evidence and excluded-page recovery. Rail hides below 1180px; inspector stacks below 900px.
- Idea chambers sit at the depth of their earliest actual evidence capture. Unknown evidence is explicitly unknown. Stable rows, custom tunnel geometry, viewport-following ruler, focus dimming, inferred dashed tunnels, keyboard selection and accessible list are implemented.
- Practice reuses the burrow connection strip, reveals saved explanations, saves three self-ratings, provides keyboard-flippable flashcards and deterministic quiz feedback. A late save cannot advance a different practice mode. Connections with no saved study item do not fabricate a review ID.
- Light/system/forced dark themes, reduced motion, visible focus, modal focus trapping and narrow title clamping are included. Full quotes remain accessible in Sources and evidence details.

## “Done when” review

| Criterion                       | Result                                                                                                                                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One primary side-panel button   | Ready: Send to Go; Updated: Open map. Handoff deliberately has no primary processing button, matching the prototype.                                                                                                                            |
| No text-glyph icons             | Icon controls use the supplied SVG paths; manifest/action use supplied PNGs.                                                                                                                                                                    |
| Amber has a meaning             | Live collection, pending/new finds and literal highlights. The spec also explicitly requests amber gap dots/boxes; these identify an unresolved gap. Ordinary processed article quotations use a neutral rule. Amber text uses `--lantern-ink`. |
| Depth reflects the trail        | Earliest real evidence sets depth; unit and packaged-browser checks exercise captures at different chronological positions. The ruler names that capture activity.                                                                              |
| Existing functionality survives | Isolated packaged-extension regression covers capture, sync, evidence, practice, restart recovery and deletion.                                                                                                                                 |

## Verification scope

`npm run check` runs TypeScript, 18 focused tests and the production build. `npm run lint` checks formatting. The packaged browser harness uses intercepted synthetic research pages, a temporary authenticated backend, synthetic saved analysis and a synthetic Go destination. It does not generate through Go or mutate the real research session.

The browser checks cover 320px light/dark without horizontal overflow, footer action count, handoff and observed save, offline/paused states, theme persistence, local fonts, reduced motion, keyboard selection/menu/card, responsive inspector, inferred tunnels, partial ratings, deterministic quiz, recall persistence and the held-save practice-mode race. Existing capture, input exclusion, include/exclude, queued review across profile restart, retry and offline deletion regressions remain included. Native website permission dialogs are pregranted in the test-only manifest; the production manifest is unchanged in that respect.

The screenshots below contain explicitly labelled **synthetic UI test data**. They document layout, not Go generation or competition results.

- [320px light panel](redesign-sidebar-light.png)
- [320px dark panel](redesign-sidebar-dark.png)
- [Workspace](redesign-workspace.png)

The prior real Go read/generate/confirmed-save/display tests are recorded separately in [status](status.md). They were not repeated as part of this visual redesign. To activate a rebuilt unpacked extension, click Reload on its card in `chrome://extensions`, then reopen the side panel; connection and session storage are retained.
