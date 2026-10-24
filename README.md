# RabbitHole

**Keep the trail. Find the connection.**

RabbitHole captures an explicitly enabled browsing session, then lets a Superhuman Go agent turn its actual sources into a concept map and recall activities. The Chrome extension handles collection and study mechanics. Go owns the generative reasoning. An authenticated backend stores and validates the results; no separate LLM API key is required.

Core code, local tests, packaged-extension browser checks, and the existing Go agent are implemented. **Hosted Go read/generate/write/display and incremental merging were verified with genuine captures on October 24, 2026.** The installed extension connects to a durable Render backend. See [current status](docs/status.md) before making integration or submission claims.

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
4. Start a session **from the side panel on your research tab**. Searches and readable pages are captured on that tab and observable child tabs. Other tabs need Include current tab. Use Alt+Shift+H or the selection context menu for highlights. Reassign at `chrome://extensions/shortcuts` if needed.
5. Inspect Sources. Pause stops new captures. Sync sends the local queue to the backend; it does not invoke Go.
6. Deploy the backend and connect Go using [deployment](docs/deployment.md) and [agent setup](docs/go-agent-setup.md). Go cannot access localhost. Open in Go attempts to copy the precise session prompt; paste/send it and approve a save when asked. Return and Sync & check Go.
7. Explore the exact saved map/evidence, then try Explain the connection, flashcards, and quiz. A self-rating is not AI grading. Fresh feedback explicitly opens Go.

The unpacked extension and a reachable backend are both required. Sharing the Go agent alone does not install the extension or grant backend access. On a browser restart the session is preserved and collection is paused; explicitly include a research tab and resume. Use a clean public-source profile for judging.

## Verification

```sh
npm run check         # typecheck, focused backend/MCP tests, production build
npm run lint          # formatter check
npx playwright install chromium
npm run test:browser  # isolated extension harness, synthetic pages and saved analysis
```

For an existing Chromium install, set `CHROMIUM_PATH` to its executable. Browser tests copy the built extension into a temporary profile and pregrant hosts in a test-only manifest, since native permission dialogs cannot be reliably automated headlessly. They never modify the production manifest and never present fixtures as Go output. Production builds contain no fixture analysis or seeded study results.

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
