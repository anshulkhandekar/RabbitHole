# Release status — October 29, 2026

This checkout is the demo candidate, with uncommitted release and user-feedback fixes preserved for owner review. The connector definition remains **schema 8**; Write approval stays **Always ask**. Current behaviour and setup are described in the [README](../README.md) and [documentation index](README.md).

## Verification boundary

The final local release gate passed after the reproduced map-startup fix and switcher regression. Local browser suites use real packaged extension code with synthetic pages and analysis in disposable profiles. Authenticated MCP tests exercise actual server validation and persistence. Neither establishes real Go instruction-following, current Google/Go page geometry, native permission prompts or teaching quality.

Earlier live testing established capture, sync and genuine Go saves, but also exposed quotation-recovery and practice clarity problems. These led to the fixes in [Stage 4](stage-4.md). The user reported a Render update at 12:24 CDT on October 29; the later rebuild still stopped after failed preflight. Current prompts explicitly require corrected complete preflights before approval. **That live recovery has not been reverified.**

## Current scope

- User-controlled capture with included tabs, search cards, article/highlight collection, Overview coalescing and one-click article Undo.
- Persisted sync queue, stable mutation IDs, strict owner/version/source validation and device-only preservation of stale answers.
- Summary, source-linked map/list, reading route, topic-aware Practice, retry families, confidence/hints and immediate attempt persistence.
- Question requests with topic/count/difficulty choices; visible-source inheritance without erasing hidden guide citations.
- Clear pending/processed receipts, original session dates with recent-use ordering, bounded map panning and a polished connection drawer.
- Explicit Go handoff, read-only preflight, approved reference save and exact-quotation recovery guidance.

## Remaining release gates

- [ ] Owner's final real-user pass using [release checklist](release-checklist.md).
- [ ] Confirm the intended backend commit is live and current Instructions are manually saved.
- [ ] A genuine 13+ find generation, correct approval identity and source-backed output.
- [ ] One real partial save or stale-answer recovery; no blocked later captures.
- [ ] Fresh question top-up/rebuild, useful difficulty and map connections retained without reload.
- [ ] Bunny on real Google/Go; native shortcuts, permissions and resume/Undo experience.
- [ ] Final commit/merge/deploy and genuine timed demo recording; add media afterward.

No live setting, connector release, deployment, commit or push is performed by this verification pass. No project license or public repository visibility has been granted. Historical milestones and audit verdicts remain dated evidence, not sign-off for this build.

## Known limits

The Go invocation path remains manual; beta/partner alternatives have not been verified. Exact quotations prove textual provenance, not truth or relevance. Generated summaries and distractors need human review. Storage and capture sizes are bounded, permanent sync failures can need intervention, tokens are manually provisioned, SQLite needs a persistent single instance, and cross-session graphs/spaced review/import are deferred. See [decisions](decisions.md) and [future work](future-work.md).

## Final local verification

Run on October 29 against the working tree in `rabbitv4-2`:

| Actual command                                                      | Exit | Result                                                                                                                              |
| ------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:release` with CHROMIUM_PATH set below                 | 0    | 219/219 regression tests; zero failures/skips; typecheck and production build; lint; both browser suites, Stage 3 and reload passed |
| `npx tsx --test tests/practice-clarity.test.ts`                     | 0    | 6/6 rendered/model cases after the new switcher case first failed                                                                   |
| `./node_modules/.bin/coda validate integrations/superhuman/pack.ts` | 0    | Pack valid; schema 8 unchanged; no release performed                                                                                |
| `npm audit --omit=dev --json`                                       | 0    | Zero known production dependency findings                                                                                           |
| `npm audit --json`                                                  | 1    | Seven development-toolchain findings: two high, one moderate, four low; no dependency changes                                       |

Exact full-gate invocation on this machine:

```sh
CHROMIUM_PATH='/Users/anshulkhandekar/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' npm run test:release
```

An earlier final-gate attempt failed at the initial map-edge assertion. A reduced reproduction captured a saved edge and measured nodes with missing internal handle bounds. The fix explicitly refreshes handle measurements after asynchronous layout. Ten consecutive cold starts then passed; temporary diagnostics were removed, and the maintained packaged-browser regression now includes repeated opens and live question-only version updates. This is a reproduced local rendering fix, not evidence of a new live Go save.

Final documentation-only changes are checked with `npm run lint` and `git diff --check`. Relative Markdown links resolve across all 29 README/docs files. Generated/private paths are absent from the changed-file list. Existing uncommitted work is retained, with intended new documentation and regression files left for owner review and staging.

Regression entry points: [Practice clarity](../tests/practice-clarity.test.ts), [map revision](../tests/map-revision.test.ts), [map geometry](../tests/map-v2.test.ts), [pan bounds](../tests/map-pan.test.ts), [session recency](../tests/session-recency.test.ts), [session dates](../tests/session-dates.test.ts), [connection drawer](../tests/connection-drawer.test.ts) and [packaged UI](../tests/ui-refresh-browser.ts).
