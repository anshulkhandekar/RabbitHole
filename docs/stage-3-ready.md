# Stage 3 test build

This workspace contains Claude's Stage 3 features plus the independently reviewed fixes. Use the build from **`rabbitv4-2/dist/extension`**, not the older sibling `rabbitv4/dist/extension`.

## Install and test

1. In Chrome, open `chrome://extensions`, enable Developer mode, and choose **Load unpacked** → this workspace's `dist/extension` folder. If that exact folder is already installed, click **Reload**. Refresh research tabs afterward.
2. Disable any other RabbitHole install while testing so two versions do not collect or show prompts at once. Loading a different folder creates a separate extension installation with separate local settings; the older installation's data stays where it is.
3. In RabbitHole Settings, configure the backend URL, your bearer token, and your Go agent URL. Grant website access when Chrome asks.
4. Search Google, start from the new card, enter your goal and familiarity, and collect a few sources. Try hide/undo, important/confusing, delete, source selection, and page/site exclusions.
5. With a saved guide, check the idea drawer, practice confidence and hints, and Summary exports. Obsidian relationships target headings in the exported note.

The archive `dist/rabbithole-stage3-test.zip` contains the same extension build. Unzip it before choosing Load unpacked. It contains no local token, database, fixture data, or test-only scripts.

## Backend and Go

The backend changes must run alongside this extension. The existing live deployment does **not** receive uncommitted local changes automatically.

- Deploy this workspace's backend through the normal merge/deployment process.
- Release connector 7 from `integrations/superhuman/pack.ts`, now pointing to `https://rabbithole-1c5e.onrender.com/mcp?schema=5`.
- Update Go's instructions from `integrations/superhuman/agent-instructions.md`. `live-agent-instructions.txt` remains a record of the older live configuration until the actual agent is updated.
- In a fresh Go chat, verify discovery of `claim`, `why`, `steps`, `buildsOn`, `nextSearch`, `hints`, `variantOf`, and the `removedCaptureIds` description. Then test a real research session and its approved save.

For collection and backend testing entirely on this computer:

```sh
npm run setup:local
npm start
```

Use `http://localhost:3210` in extension Settings and copy the token from the ignored `.env` file locally. The database lives in this workspace's ignored `data/` directory. Go cannot reach localhost; this mode does not test real Go generation.

## Fixes included

- Go responses and learning exports filter hidden/removed evidence, including receipts inside saved analysis. Hidden evidence restores on undo. Deletion permanently erases saved source quotations while retaining other hidden receipts. The full JSON backup retains recoverable hidden finds.
- Deletion always sends a tombstone, including when an upload may have committed before an error response. Deleting a capture that has not arrived yet is safe and idempotent.
- Deleted automatic source content stays dismissed across page reloads and sync refreshes. Only a content hash is retained locally. New content can still be collected; explicitly including the page again clears its dismissal.
- Important/confusing tags no longer cause duplicate captures. Deleting similarly prefixed IDs does not cancel unrelated queued changes.
- Rebuild works after replacing all previously processed sources.
- Enter submits the search card using the trusted key event. Repeated submissions are guarded, and messaging failures leave a retryable card.
- The map uses one viewport update when fitting after resize, preventing a delayed fit from racing with idea selection.
- Desktop navigation stays in the header layout instead of covering the collection controls.
- Markdown/Obsidian relationships link within the exported note.

## Verification

Final local verification passed: **87 unit tests**, typecheck, production build, formatting, the original browser suite, the Stage 3 user-flow suite, and the actual extension-reload suite. No settling delay was added to the original browser test. Desktop-header geometry and light/dark screenshots were also checked. All code remains uncommitted and undeployed.

```sh
npx playwright install chromium  # once, if the matching browser is missing
npm run test:release
```

The release command runs typechecking, all unit tests, production build, formatting, the original packaged browser suite, the new Stage 3 user-flow suite, and the real extension-reload suite. Browser tests use isolated profiles and synthetic sources; they do not alter personal sessions or the installed extension.

The Stage 3 browser flow checks trusted keyboard start, rejected synthetic clicks, topic switching, resume, opt-out, source hide/undo, explanation fields in light and dark mode, persisted quiz confidence/hints/reasoning, real Anki/Markdown downloads, automatic recapture suppression, and deletion after a committed POST returns an error.

These checks validate the local implementation. Live Google markup, native permission prompts, real Go-generated content, and actual third-party import applications still require a final real-account smoke test after deployment. The local checks do not establish that the live Go integration has been upgraded.
