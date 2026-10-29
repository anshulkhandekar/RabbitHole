# Development

Use Node 22.20+ and the locked dependencies in `package-lock.json`.

```sh
npm ci
npm run setup:local
npm run dev
```

`setup:local` creates ignored credentials if absent; do not replace a configured environment casually. `npm run dev` watches the backend. `npm run build` typechecks and bundles the extension/server into `dist/`. Load `dist/extension` as an unpacked Chrome extension. See [setup](setup.md) for backend and Go configuration.

## Repository structure

| Path                      | Responsibility                                                      |
| ------------------------- | ------------------------------------------------------------------- |
| `apps/extension`          | Content script, MV3 worker, reading widget and React workspace      |
| `apps/server`             | Authenticated REST/MCP endpoints, validation and SQLite storage     |
| `packages/contracts`      | Shared runtime schemas and backward-compatible data types           |
| `integrations/superhuman` | Connector definition and canonical agent instructions               |
| `tests`                   | Model/UI/worker regressions and packaged-extension browser fixtures |
| `scripts`                 | Build, local setup, license generation and isolated UI preview      |
| `docs`                    | Architecture, setup, development, testing and design decisions      |

## Checks

```sh
npm run check
npm run lint
npm run test:release
git diff --check
```

The [testing guide](testing.md) describes scope, Chromium configuration and manual acceptance. `npm run format` applies the repository's formatting. `npx coda validate integrations/superhuman/pack.ts` validates the connector without releasing it.

Use `tests/worker-harness.ts` for worker behaviour; its custom fetch option supports failure and concurrency cases. Keep new stored fields optional, existing sessions readable and validation at least as strict. Tool-contract changes require a deliberate discovery revision and live schema check. Instruction-only changes do not.

## Installed extension

Rebuilding replaces `dist/`. Reload the extension in `chrome://extensions`, refresh existing research/Go tabs and reopen the panel to activate new UI, worker and content scripts. Saved research remains in Chrome storage. Browser restart clears tab bindings and pauses collection; resume and include a research tab when needed.

## Data and artifacts

`.env`, `data/`, `dist/`, `node_modules/`, `test-results/` and browser reports are ignored. Keep credentials, databases, real session exports and account screenshots out of Git. Product assets and third-party notices belong in the repository. Deliberately published feature media should be curated separately from generated QA output.

Do not use a broad `git clean -fdx` as routine cleanup. Preserve installed builds, configured data and browser profiles. Tests use disposable profiles rather than the real research account. Changes to the backend, extension, connector and live Instructions have separate rollout paths; see [setup](setup.md#updating-an-installation).

For database backups, use SQLite's online backup API or a host snapshot. Copying only the main file during active WAL writes is not a dependable backup. Keep a persistent disk and a single service instance.

## Dependency review

Run `npm audit --omit=dev` for production dependencies and `npm audit` for the complete toolchain. As of October 29, 2026, production reported zero findings; the full tree reported seven development findings (two high, one moderate, four low), including the Packs SDK tree. The suggested SDK remedy was a major-version downgrade, so no forced dependency change was made. Development-tool findings still require review even though those tools are not bundled into the production server. Audit counts are time-dependent.
