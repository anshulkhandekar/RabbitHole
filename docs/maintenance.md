# Development and artifact maintenance

## Start safely

Use Node 22.20+. Read the checkpoint/status and run `git status --short` before editing. Do not overwrite another chat's changes. Dependencies are locked by `package-lock.json`. `npm ci` restores them. `npm run setup:local` creates local credentials when needed; never run setup to replace an already configured environment casually.

Local configuration and SQLite live in ignored `.env` and `data/`. Keep them private and preserve them during cleanup. Do not assume the local token is the hosted token. Back up hosted SQLite using its online backup API or a host snapshot before any database migration; do not copy only the main file while WAL writes are active.

## Verification

```sh
npm run check
npm run lint
npx coda validate integrations/superhuman/pack.ts
npm run test:browser
npm run test:reload
```

The first command runs 32 focused tests, TypeScript and the production build at Stage 1. Browser harnesses need Playwright Chromium or an explicit executable path. On this Mac the previously verified invocation is:

```sh
CHROMIUM_PATH='/Users/anshulkhandekar/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' npm run test:browser
CHROMIUM_PATH='/Users/anshulkhandekar/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' npm run test:reload
```

That path is machine-specific and may change when browsers are updated. Both harnesses use disposable profiles. The main browser harness runs a temporary authenticated backend and synthetic pages/analysis, and recreates screenshots in ignored `test-results/`. It cannot establish live generation quality. `test:reload` checks actual runtime invalidation, not the user's native extension reload-and-refresh experience. No real research session should be used as a disposable fixture.

Dependency review: `npm audit --omit=dev` covers the production dependency tree; full `npm audit` also includes the Packs SDK toolchain. Record actual results, distinguish production and development findings, and review changes rather than applying an unrelated forced dependency upgrade.

## Builds and installed Chrome

`npm run build` replaces `dist/` and regenerates the extension/server. The installed unpacked extension points to `dist/extension`; retain that directory. Activate new code with Reload on RabbitHole's `chrome://extensions` card, then refresh existing Go/research tabs once and reopen the panel. Saved research remains in Chrome storage; browser restart clears tab bindings and conservatively pauses collection. Explicitly include a tab and resume when necessary.

Go configuration has a separate release path. Save agent instructions in the builder. Build/release connector changes in Pack Studio. Verify the exposed tool schema in a fresh Go chat; see [setup and schema troubleshooting](go-agent-setup.md). Preserve the existing account connection and Always ask for writes. A Git push alone does not update these settings.

## What stays locally

| Keep                                                               | Reason                                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Source, tests, lockfile, docs, source PNG/SVG assets               | Reproducible implementation and design                                    |
| `THIRD_PARTY.md`, `THIRD_PARTY_LICENSES.txt`, bundled font notices | Attribution and distribution obligations                                  |
| `.env`, `data/`, saved Chrome state                                | Private configuration and research; never commit                          |
| `dist/extension`                                                   | Current installed extension loads from it                                 |
| `node_modules/`                                                    | Ignored local dependency installation; regenerable, but not random output |

Generated `test-results/`, `playwright-report/`, old account/deployment screenshots and copied UI screenshots are disposable after review. Stage 1 removed these screenshot artifacts, including stale tracked copies in `docs/`. The tests can regenerate synthetic screenshots when needed. Source icons under `apps/extension/public` are product assets and must remain.

Clean only named generated directories; do not run a broad `git clean -fdx`, remove all PNGs recursively, or delete browser profiles/data. Do not clean the original brief/design references outside the repository. Screenshot removal from the current checkout does not purge past Git history; do not rewrite history without a separate reason and authorization.

The Stage 1 milestone uses the annotated `stage-1-complete` tag. It marks the documented baseline, not public publication or competition completion. Repository visibility and project-license decisions remain unchanged.
