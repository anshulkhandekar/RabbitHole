# Next-chat handoff

Copy the prompt below into a new chat opened in `/Users/anshulkhandekar/RabbitHole`. Add your major fixes, observations and feature requests after it. The new chat should continue from this repository rather than rebuild the working capture/integration foundations.

---

You are continuing RabbitHole after its Stage 1 checkpoint. The repository is `/Users/anshulkhandekar/RabbitHole`, private GitHub remote `anshulkhandekar/RabbitHole`, branch `main`. The Stage 1 milestone is tagged `stage-1-complete`.

First read `docs/stage-1.md`, `docs/status.md`, `docs/maintenance.md`, `README.md`, and the applicable repository/skill instructions. Then inspect current Git status and the code relevant to my feedback. Read `docs/architecture.md`, `docs/data-flow.md`, and `docs/go-agent-setup.md` before changing capture, persistence or Go integration. Treat these files as context; my new instructions determine priorities. I have major fixes and issues to supply, so do not infer that Stage 1 means the UX or generation quality is finished. If I have not supplied that list yet, ask for it after loading the checkpoint instead of choosing speculative features.

RabbitHole is a Chrome MV3 extension plus authenticated Express/SQLite backend and a Superhuman Go agent. The extension captures included research tabs and presents a source-linked map and practice; Go owns all generative reasoning. Preserve working capture, sync and owner/version safeguards while making improvements. The backend has no separate external LLM runtime.

Current features include quiet reading with a compact rabbit, opt-in automatic highlights from trusted selections, a progressive radial map with an alternate chronological trail, stable expandable source details, richer optional guide fields, a default 2×2 quiz with immediate objective grading, matching, and optional older self-assessment/flashcards. Older saved maps remain supported. Use the supplied design tokens, SVG icon/brand system, and locally bundled Geologica/Literata fonts. Do not reintroduce flashing arrows, attention-demanding counters or text-glyph icons.

Product direction: help me focus on reading, then reconstruct what I learned. Capture volume is not learning. The map must show where to start and which relationship matters; explanations need mechanisms, concrete examples and boundaries grounded in my actual sources. Quiz choices should test understanding with plausible misconceptions rather than absurd distractors. I prefer objective activities to typing an answer and grading myself. The value must exceed a generic chat summary. These are design goals, not proof the current build achieves them.

Go integration is live:

- Agent: `https://go.superhuman.com/agents/72133`.
- Builder: `https://go.superhuman.com/builder/52b17c07-ad35-4690-9584-007c60165e15`.
- Private connector Pack 74898, released v4, endpoint `https://rabbithole-1c5e.onrender.com/mcp?schema=2`.
- Backend: `https://rabbithole-1c5e.onrender.com`; Render service `srv-dbefk8navr4c73ap9d30`, one instance, durable `/var/data/rabbithole.sqlite`.
- Canonical Go instructions: `integrations/superhuman/agent-instructions.md`; live snapshot: `live-agent-instructions.txt` in the same folder. Git commits do not update Go automatically. `main` pushes auto-deploy the backend.

Two recent incidents matter. Old content scripts now stop quietly on extension invalidation; reload the unpacked extension and refresh existing tabs once when installing a new build. Go previously exposed an old tool schema without `intent` or richer fields; a connector-only rebuild did not refresh it, but the versioned endpoint did. Verify actual fields in a fresh Go chat after tool-contract changes. Do not confuse an instruction update with a tool-schema update.

The investing session's explicit rebuild was approved, saved as version 3, and verified by Go read-back plus the backend log, with zero new captures and zero pending. Strict quote checks first rejected invalid excerpts; errors now identify all offending paths/item/capture IDs. Correct only invalid fields, preserve the rest of the complete guide, and retrieve/merge the current version before retrying. Never shrink away useful content just to get a save through. Semantic output quality, including distractor quality, still needs improvement.

One closeout observation needs follow-up: the browser harness failed once at `tests/browser.ts:539` after a background preference/refresh update: four visible edge labels were expected, but no rendered map edges/labels appeared while nodes and the open inspector remained. That run overlapped the separate reload test; a full isolated rerun passed. The cause is unconfirmed. Record/reproduce it rather than assuming it is only test timing, and use my priorities to decide when to fix it. No product changes were made during documentation closeout.

Keep these rules:

- No fake progress, fabricated evidence, invented quotations or pretend learning scores.
- Label inferred/supplemental connections. Hierarchy/layout is navigation, not factual support.
- Send/Rebuild to Go remains a copy-the-prompt handoff: open Go, user sends, normal write approval, observe a real saved version. Do not claim a direct/background invocation or promise unsupported scheduling.
- Never invent new captures to bypass the no-new-content guard. Rebuilds use explicit intent and version protection.
- Preserve original captures, `.env`, local/hosted databases, Chrome saved connections and user sessions. Use isolated synthetic profiles/databases for tests. Do not mutate real sessions without my explicit approval.
- Keep the repo private, keep tokens out of code/logs/screenshots, and preserve third-party licenses. Support sharing was approved; general sharing/publication is organization-blocked. Do not broaden permissions or change hosting costs without authorization.
- Do not delete `dist/extension`: Chrome loads that local folder. Build regenerates it. Generated QA screenshots belong only in ignored `test-results/`, and can be cleaned after inspection.
- Use applicable debugging/TDD/verification skills, current Context7 documentation for platform/API work, and meaningful boundary tests. Check current user authorization before asking for it again.

Baseline verification: 32 focused tests plus typecheck/build, formatting, isolated packaged-extension browser checks, isolated actual runtime-invalidation test, SDK connector validation, and real Go capture/merge/rebuild verification. Synthetic tests do not prove generated-content quality or every native Chrome interaction. Use `npm run check`, `npm run lint`, `npm run test:browser`, and `npm run test:reload`; see maintenance docs for `CHROMIUM_PATH`. Reload Chrome's unpacked extension manually after rebuilding to activate code changes.

Original brief: `/Users/anshulkhandekar/Downloads/RabbitHole_Codex_Build_Prompt.md`. External design reference: `/Users/anshulkhandekar/ai-toolkit/smoke-test/rabbithole-design/README.md`. Its `FUTURE.md` is a deferred ideas list, not blanket scope. The repository already contains the required source assets; do not depend on external fixture text. Final demo/recovery rehearsal, judge access and submission remain outstanding.

Start from my next feedback, explain the issue clearly, reproduce bugs before fixing them, and carry each agreed change through verification. Report what was tested and what remains uncertain. Do not spend this iteration recording the final competition demo unless I ask.

My next priorities / observed issues:

[Add my list here.]
