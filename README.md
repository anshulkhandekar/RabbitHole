# RabbitHole

**Keep the trail. Find the connection.**

RabbitHole captures an explicitly enabled browsing session, then lets a Superhuman Go agent turn its actual sources into a concept map and recall activities. The Chrome extension handles collection and study mechanics. Go owns the generative reasoning. An authenticated backend stores and validates the results; no separate LLM API key is required.

**Stage 3 test build — October 27, 2026.** Search cards, source controls, richer explanations, confidence/hints, and exports are implemented, with fixes for source removal, offline deletion recovery, keyboard submission, and map resizing. Start with the [current test-build guide](docs/stage-3-ready.md) for installation, verification, and the remaining live backend/Go update. Earlier checkpoints remain in [Stage 1](docs/stage-1.md) and the [handoff](docs/handoff.md).

## Quick start

Requires Node 22.20+ and Chrome 120+.

```sh
npm ci
npm run setup:local
npm run check
npm start
```

The setup command creates an ignored `.env` with a random personal token without printing it. Server defaults to `http://localhost:3210`; SQLite persists in ignored `data/rabbithole.sqlite`. Open `.env` locally and copy only your token value from `RABBITHOLE_USERS` into extension Settings. Never commit/share this file.

1. In Chrome, open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose this project's `dist/extension` folder.
2. Pin RabbitHole. Open a normal research webpage and click its toolbar action to open the side panel.
3. Open Settings. Enter the backend URL, personal token, and your saved Go agent URL. Save and grant optional website access when Chrome asks.
4. Start a session **from the side panel on your research tab**. Searches and readable pages are captured on that tab and observable child tabs. Other tabs need Include tab. Use Alt+Shift+H or the selection context menu for highlights. Reassign at `chrome://extensions/shortcuts` if needed.
5. Read without watching the trail: use **Read without sidebar** for a compact rabbit indicator. Automatic highlights are an opt-in session setting; manual selection shortcuts still work. Pause stops new captures. Automatic sync sends the local queue to the backend; it does not invoke Go.
6. Deploy the backend and connect Go using [deployment](docs/deployment.md) and [agent setup](docs/go-agent-setup.md). Go cannot access localhost. Send to Go attempts to copy the precise session prompt and opens your agent. Paste/send it and approve a save when asked. The extension polls for an actual saved analysis; it never presents opening Go as generation.
7. Start at the main idea on the radial map, explore a branch, and inspect its short source excerpts. Practice opens on Quiz; matching provides another objective check. Open-response and flashcards remain optional. Use **Rebuild with Go** to enrich an older map without inventing new captures; paste/send and approve its save.

The unpacked extension and a reachable backend are both required. Sharing the Go agent alone does not install the extension or grant backend access. On a browser restart the session is preserved and collection is paused; explicitly include a research tab and resume. Use a clean public-source profile for judging.

## Verification

```sh
npm run check         # typecheck, focused backend/MCP tests, production build
npm run lint          # formatter check
npx playwright install chromium
npm run test:browser  # isolated extension harness, synthetic pages and saved analysis
npm run test:reload   # actual runtime-invalidation cleanup in a disposable profile
npm run test:stage3   # new search/source/practice/export user flow and deletion recovery
npm run test:release  # all of the above, including build and formatting
```

For an existing Chromium install, set `CHROMIUM_PATH` to its executable; see [maintenance](docs/maintenance.md) for the verified local path. Generated screenshots go in ignored `test-results/` and are not retained as repository documentation. Browser tests copy the built extension into a temporary profile and pregrant hosts in a test-only manifest, since native permission dialogs cannot be reliably automated headlessly. They never modify the production manifest and never present fixtures as Go output. Production builds contain no fixture analysis or seeded study results.

The [reading-first iteration](docs/reading-first.md) records the current behavior, rich-analysis contract and verification limits. The earlier [UI redesign verification](docs/ui-redesign.md) records the supplied design, local fonts, responsive states and evidence-depth layout. After rebuilding an installed unpacked extension, click **Reload** in `chrome://extensions` to activate its new UI, worker and icons. Refresh existing Go/research tabs once after reloading to replace old content scripts. Your saved connection and sessions remain in Chrome storage.

## Components

| Location                  | Responsibility                                                         |
| ------------------------- | ---------------------------------------------------------------------- |
| `apps/extension`          | Content script, MV3 service worker, React side panel/workspace/options |
| `apps/server`             | Authenticated API, three MCP tools, SQLite transactions                |
| `packages/contracts`      | Shared runtime schemas and IDs                                         |
| `integrations/superhuman` | Paste-ready agent configuration                                        |
| `tests`                   | Consequential boundaries and isolated browser harness                  |
| `docs`                    | Setup, design, platform research, demo, teaching, honest status        |

Read [architecture](docs/architecture.md), [data flow](docs/data-flow.md), [learning design](docs/learning-design.md), [five-minute explanation](docs/explain-it-to-me.md), and [demo/submission storyboard](docs/demo.md).

## Limits and publication

Article text is bounded at 12,000 characters; sessions at 300 captures. AI Overview extraction is conservative and may require manual selection. Tab lineage is observable continuity, not AI relevance classification. Device storage is finite; export/delete old sessions. Auth is personal static tokens for the prototype; keep privileged credentials server-side. SQLite requires the documented durable mount and a single service instance. Review [status](docs/status.md) for unverified/deferred items.

Keep the repository private until explicitly approved for release. No project license has been granted yet; **MIT is proposed for later approval**, with third-party licenses preserved. Before publication: remove secrets, research databases, personal fixtures/account screenshots and Git history leaks; rotate any exposed tokens; review dependencies and attribution; verify demo data permissions; choose the project license; and re-run checks. See [THIRD_PARTY.md](THIRD_PARTY.md).
