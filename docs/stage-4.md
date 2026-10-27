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
