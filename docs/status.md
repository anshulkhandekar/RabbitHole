# RabbitHole status — October 27, 2026

Stage 3 is implemented and independently verified locally: 87 unit tests, typecheck, production build, formatting, the original packaged browser suite, the Stage 3 user-flow suite, and the actual extension-reload suite pass. Source-removal, deletion recovery, keyboard submission, exports, and map/header fixes are included.

The main-branch deployment, connector release 7 (`schema=5`), and live instruction update are in progress. See [the current build](stage-3-ready.md) and [Stage 3](stage-3.md). Live verification will be recorded here after those operations finish.

## Historical Stage 1 status — October 24, 2026

**Stage 1 is complete as a development checkpoint.** The core product is implemented and deployed, including genuine Go generation, incremental merging and an explicit rich-guide rebuild. This does not close the user's upcoming major fixes, establish consistently strong generation quality, or complete competition submission.

Start with [Stage 1 checkpoint](stage-1.md), [next-chat handoff](handoff.md) and [maintenance](maintenance.md). The milestone is `stage-1-complete` on the private repository's `main` branch.

## Current behavior

- Scoped Chrome sessions, search/article/manual highlights, conservative Overview extraction, local retry queue and authenticated ownership.
- Quiet reading with a compact static rabbit and optional automatic highlights from completed trusted selections.
- Progressive radial overview, branches, stable evidence inspector, chronological alternate view and accessible list. Inferred/supplemental relations remain labelled.
- Rich optional overview, hierarchy, takeaways, illustrations, boundaries and exact source excerpts. Legacy saved maps remain supported.
- Default quiz grid with immediate persisted objective grading; matching; optional self-assessment and flashcards.
- Honest Send/Rebuild to Go prompt handoff. Opening Go does not invoke processing. Only an actual saved version produces an updated analysis state.
- Strict atomic saves, stale-version protection, processed-source/reference validation, quotation checking, and targeted invalid-evidence diagnostics.
- Supplied design identity, source icons, local variable fonts, responsive light/dark UI, static graph edges and reduced-motion handling.

## Verification evidence

| Check                    | Recorded result and scope                                                                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`          | 32 focused tests, TypeScript and production build pass                                                                                                                                                                  |
| `npm run lint`           | Formatting passes                                                                                                                                                                                                       |
| Official MCP client test | Authenticated local read → save → exact retrieval; explicit rebuild via versioned endpoint; advertised rich fields checked                                                                                              |
| `npm run test:browser`   | Isolated rerun passed; initial concurrent run failed (see closeout observation). Synthetic capture/scope/sync/retry/restart/delete, map/practice, inspector retention, local fonts, 320px light/dark and reduced motion |
| `npm run test:reload`    | Actual `chrome.runtime.reload()` invalidates old scripts; collecting indicator removed and subsequent polls produce no uncaught page errors                                                                             |
| SDK validation           | Connector definition validates with installed Packs SDK 1.18.4                                                                                                                                                          |
| Hosted service           | Render deployment `e4be833` verified Live; public health succeeds; authenticated owner-scoped Go operations verified                                                                                                    |

The browser harness pregrants hosts in a test-only manifest. It does not test every native permission/panel gesture, current live Google variants, real network/profile recovery, or generated teaching quality. Synthetic screenshots are reproducible QA output, not live integration evidence; generated copies were removed during Stage 1 cleanup.

Stage 1 closeout audit: `npm audit --omit=dev` reports **0** known vulnerabilities. Full `npm audit` reports **6 development-toolchain advisories** (2 high, 4 low), including Packs SDK's Zod dependency; the audit reports no available compatible fix for those high findings. The SDK is not imported by the production server. Results are time-dependent: rerun before submission, distinguish the two trees, and do not describe the entire installation as advisory-free. No forced unrelated dependency upgrade was made during this documentation checkpoint.

## Genuine live verification

- **Original GPU flow:** Google/NVIDIA source captures → actual Go GetSession/generation → approved SaveSessionAnalysis → exact extension map. Incremental CUDA article/highlight merging saved version 2 and retained an original connection attempt. A zero-pending ordinary run did not save. Persistence across deployment was verified.
- **Rich investing rebuild:** the user explicitly approved replacing the guide for session `033a9e8a-3189-48bf-af7b-10582756680d`. After schema discovery repair and quote corrections, the rebuild saved **version 3**, **0 new captures processed**, **0 pending**. Go re-read the session and confirmed overview, hierarchy, excerpts, quiz explanations and matching. The backend independently logged `analysis_saved` version 3. This particular rebuilt version was not separately rechecked in the extension UI.
- **Connector:** Pack **74898**, released **v4**, uses per-user HeaderBearerToken and `/mcp?schema=2`. Fresh Go diagnostics expose `intent`, `overview`, concept hierarchy/evidence and matching fields. Read remains Always allow; Write remains Always ask.
- **Agent:** https://go.superhuman.com/agents/72133. Current instruction snapshot is in `integrations/superhuman/live-agent-instructions.txt`; configuration changes are not automatically deployed by Git.
- **Installed extension:** website access, configured connection, capture pause/resume, manual shortcut, evidence/practice and retained progress were exercised earlier. Real sessions and connection state remain user data.
- **Review access:** Share with support enabled with authorization. General publishing/sharing remains blocked by the organization. Repository remains private; no project license has been granted.

## Recent fixes

1. Orphaned content scripts now catch synchronous and asynchronous messaging failures and retire their listeners, observers, timers and indicator on invalidation. Reload the extension and refresh existing tabs when installing a new build.
2. Go retained an older save-parameter schema despite a fresh chat and connector-only build. Versioning the same authenticated endpoint in connector v4 exposed the richer contract. Future contract changes need live schema checks, not just updated instructions.
3. Quote failures now identify all invalid evidence paths/item/capture IDs. Correct those fields and preserve the rest of the full guide; failed validation cannot partially overwrite it. Stale writes still require a current read and merge.

## Closeout browser observation

The initial closeout browser run, launched alongside `test:reload` in separate disposable profiles, failed at `tests/browser.ts:539`: `.edge-label.visible` expected 4, received 0 after the synthetic preference patch and background refresh. The inspector disclosure remained open. The failure snapshot showed radial nodes and the inspector but no rendered connection paths/labels; the edge container retained only its marker definition. No product code changed during closeout. Running the full browser harness again on its own passed, as had the earlier feature verification runs. This is an intermittent rendering/test observation with an unconfirmed cause, not proof that concurrency is responsible or that the product is free of a map bug. Retain it as an early Stage 2 reproduction target. Both the failed and successful outcomes are recorded here; generated screenshots/logs are not retained in the checkout.

## Open issues and deferred work

The user has additional major fixes and issues to describe in the next chat. Their priorities supersede speculative roadmap choices. Stage 1's structural checks and one successful rich rebuild do not settle map intuitiveness, explanation depth, plausible distractors, semantic claim accuracy or whether the product offers enough value over a chat summary. Some generated distractors in the verified flow were still too easy.

Known limitations include narrow Overview parsing; tab lineage rather than semantic relevance; finite capture/storage bounds; paused collection and cleared bindings after restart; permanent queue failures requiring intervention; no import/restore UI; personal static-token auth; single-instance SQLite; and no autonomous Go trigger or reliable unattended scheduling claim. See [checkpoint](stage-1.md) for deferred candidates.

## Competition gates

- [x] Hosted authenticated service with durable storage, private connector and genuine Go read/generate/approved-save/display.
- [x] Genuine incremental merge and retained progress.
- [x] Genuine explicit rich rebuild with post-save read-back and backend confirmation.
- [x] Share with support enabled.
- [ ] Final clean-profile native permission/panel/shortcut and real network/browser-restart recovery rehearsal.
- [ ] Strong content-quality review on representative sources after Stage 2 improvements.
- [ ] Timed genuine demo, isolated judge setup, final organizer-rule check, video visibility and submission.

The organizer submission page was reviewed on October 24 and stated October 31 with a write-up, agent link and video. Loom/under-five-minutes came from the supplied brief. Recheck rules before final submission. The observed scheduler offered Hour/Day/Week/Month, no minute unit; no schedule was enabled or unattended save verified. These are dated observations, not promises about future platform capability.
