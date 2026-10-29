> Historical checkpoint / audit. For the current build, use the [documentation index](README.md), [status](status.md) and [release checklist](release-checklist.md). Dated results below are not current live sign-off.

Perform RabbitHole's final adversarial regression audit before I test it myself as a real user.

Checkout: /Users/anshulkhandekar/RabbitHole/rabbitv4-2
Branch: anshulkhandekar/rabbitv4-2

Run git status --short first. Preserve all uncommitted release fixes and untracked files. This is testing only: do not edit production code or existing tests, commit, push, deploy, release a connector, change live Go Instructions/approval settings, or use my normal Chrome profile, personal sessions, tokens, or database. Do not weaken validation or use “Always allow”. New diagnostic scripts may live under test-results/final-release-audit-2026-10-28/.

Use an isolated Chrome for Testing profile, a throwaway local SQLite backend and synthetic/public fixtures. Route Google/Go/article pages to fixtures; keep authenticated requests on the local backend. I will do real-user/live Go testing afterwards. Do not block this lab audit on deployment or live instructions being stale.

Read the current git diff and:

- docs/stage-4.md, including the final residual and approval/evidence sections
- docs/data-flow.md
- docs/release-evaluation-2026-10-28.md
- test-results/release-retest-2026-10-28/REPORT.md
- test-results/residual-retest-2026-10-28/REPORT.md
- integrations/superhuman/agent-instructions.md
- tests/release-integrity.test.ts and the worker/UI regression harnesses

Run these exact commands and record actual exits/counts:

```sh
npm run check
npm run lint
git diff --check
CHROMIUM_PATH='/Users/anshulkhandekar/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' npm run test:release
```

Expected baseline: 181 tests and both packaged-browser suites, Stage 3 and reload pass. Do not alter assertions to obtain green results. Add independent adversarial lab cases rather than merely repeating existing tests. Look for incorrect state transitions and data loss, not just console errors.

Prioritize these cases:

1. Approval identity (F12): validate session A, then supply a nonexistent ID, another owned session B, swapped/spliced IDs, wrong title, another owner's draft, expired draft, deleted target and stale version. No incorrect save or partial mutation is allowed. Only a valid owned draft's mismatch error should supply its exact retry arguments. Corrected retry saves once; replay does not increment again. Verify the official MCP client sees the actionable error and normal input schemas/write annotations remain unchanged at schema 8. Backend protection does not prove that real Go will never display a malformed approval card; explicitly leave that client behavior for manual verification.

2. Title/evidence integrity (F17): preserve named session titles on first, incremental, rebuilt and question-only saves, including a rename after preflight. An unnamed “New rabbit hole” adopts its first generated title once. Keep the generated analysis title separate. Narrow the citations on the same question and answer key, including while adding hints/feedback: visible saved sources and quotes must survive. Check duplicate/reordered citations, whitespace-equivalent quotes, all activity types, hidden/deleted sources, changed questions, deliberate rebuild replacement, and source/quote limits. Never resurrect removed evidence or silently truncate receipts. Invalid quotes and source changes between validation/approval must reject atomically.

3. Persistence and concurrency: check quiz/matching then reload immediately, including while POST delivery is stalled. Header counters must reflect durable storage before network completion; Continue/Enter/End must not duplicate attempts. Type reasoning while the check is still in flight, then refresh/reload. Later note updates must preserve the answer/key, remain local after a version change, and not mislabel an already-synced answer local-only. Exercise Go saves during rounds, 409 stale answers, uncertain delivery/retry, 503 recovery, and a later capture/edit behind each failure. Errors for still-failing queue items must not vanish on refresh.

4. Question-only saves: hide one of two cited sources, top up, then unhide. Preserve every previous stored-guide field except the appended question list. Reject unsupported targets, unknown IDs, reused question IDs, invalid answer keys, stale versions and newly hidden/deleted evidence with actionable question-specific errors. Check parent chains/overview routes when their only visible supporting source disappears, and enforce the total activity limit including hidden questions.

5. Collection and lineage: perform rapid same-tab result navigation; growing overviews; topic switches after captures already synced; processed versus pending overviews; delete/revisit/dedup; multiple Google tabs bound to different sessions; included child tabs before opener scan; pause/restart and explicit Include. Sources must retain the correct session and parent. Check stylesheet-hidden/consent content, title=H1 joining, paragraph/list/code boundaries and the capture length limit.

6. Bunny: use saved top-right positions over a 40px avatar/settings button, tiny controls between sample points, wide controls and nested clickable children. Verify rectangle non-intersection, unchanged saved preference after temporary nudges, no snap-back on rescans, SPA navigation, dragging, resize/clamping and the mid-height default. Use real layout in the isolated browser, not only jsdom mocks.

7. Settings/handoffs: fast analogy typing plus a quick depth change; Escape/backdrop/close without blur; session-only and shared scope in isolated profiles. Verify partial-save processed counts, singular/plural wording, both receipts, ten-minute stall/deleted-find paths, notification modes and unread-map state across multiple saves.

8. Practice/evidence/export: orphan and nested-main maps, matching/cross-topic questions, topic totals, original-only New/Harder readiness, no-hard-bank messages/prompts, sibling review and retry labels, hints/guesses versus strong results, partial-matching switch warnings, hidden-source drawer fallback, singular copy, exports, nested landmarks, keyboard/focus dismissal, light/dark and narrow layouts.

For state-machine bugs, vary ordering: persist → reload → retry; validate → hide/delete/rename → approve; check → Go save → refresh; create/capture → uncertain response → retry. Test one-minute retry/restart behavior with controlled clocks where useful. Compare observable local and server states, IDs, versions and evidence, using independent expected values.

Save sanitized evidence and REPORT.md under test-results/final-release-audit-2026-10-28/. Never write credentials/private content into logs or artifacts.

Report each area as PASS / FAIL / NOT TESTED, with evidence type (automated, isolated browser/backend/MCP, code inspection, or actual live). Include exact commands/exits/counts, reproducible steps, file/line references, expected versus actual state, and minimal sanitized artifacts for failures. Separate confirmed release blockers, lower-priority defects, and hypotheses needing reproduction. Do not invent issues to meet a quota or claim that finite tests prove no bugs exist.

End with a concise GO / NO-GO for my manual testing, the remaining risks, and a short real-user checklist. Leave live verification explicitly undone: backend deploy, extension/tab reload, live Instructions from rabbitv4-2, real Go output/approval quality, one partial/stale save, and bunny placement on actual Google/Go pages are still mine to check. Do not fix findings during this audit.
