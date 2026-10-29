# Demo and submission plan

Record only after the [final live checklist](release-checklist.md) passes. Use genuine public-source research and actual Go tool calls. Automated fixture output is QA evidence, not a substitute for live generation. Check the current organiser requirements before submission; the earlier brief requested a short Loom video under five minutes, but that requirement has not been reverified in this pass.

## Story: research that survives the tabs

Use a topic you can explain naturally, such as how AWS services work together. Start with a concrete question, follow a few authoritative pages and save one useful highlight. Build the larger 13+ find rehearsal beforehand to check pagination; the recorded narrative can show a short representative portion without implying omitted steps happened instantly. Avoid personal accounts, tokens and unrelated research.

| Time      | Screen                          | Point to demonstrate                                                                                                              |
| --------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:25 | Research tabs and the problem   | Following links is easy; reconstructing mechanisms and relationships later is harder. Use an authentic personal motivation.       |
| 0:25–1:05 | Collect, highlight, pause/Undo  | Intentional capture with visible control, a quiet bunny and recoverable mistakes.                                                 |
| 1:05–1:55 | Send to Go and real tools       | Paste/send, paginated source read, read-only validation and a normal approved SaveValidatedAnalysis. Label time cuts.             |
| 1:55–2:40 | Summary, map and source drawer  | Explain one meaningful relationship, inspect evidence and distinguish an inference. Show synthesis rather than reciting the page. |
| 2:40–3:25 | Practice hub and checked answer | Clear topic/lane/difficulty, plausible choices, immediate saved feedback and review.                                              |
| 3:25–3:50 | Return or incremental update    | Retained progress and an actual updated guide, if rehearsed.                                                                      |
| 3:50–4:15 | Architecture and tradeoff       | Extension preserves the trail; Go reasons; validated persistence makes it reusable. Explain the explicit handoff honestly.        |

Do not promise one-click generation, autonomous writes or measured learning improvement. A failure during the real run must be shown honestly or repaired before recording. A previously saved genuine guide can be labelled as such; it is not a new live generation.

## Judge-facing explanation

- **Problem:** browser history is a list of addresses, while understanding requires relationships and retrieval practice.
- **Contribution:** a scoped trail becomes an inspectable guide with evidence and revisitable questions.
- **Go integration:** actual authenticated source reads, generation, strict preflight and approved persistence. The backend has no separate LLM.
- **Engineering:** owner isolation, atomic version protection, offline queue, recoverable source controls and backward-compatible saved data.
- **Tradeoffs:** manual Go invocation, static prototype tokens, finite storage, single-instance SQLite and human review of semantic quality. See [decisions](decisions.md).
- **Future:** supported invocation integration, better quality evaluation, cross-session review and stronger identity/operations. See [future work](future-work.md).

## README media after recording

Capture three or four short, cropped clips from the final genuine demo: quiet capture/highlight/Undo; Go validation and approval; map evidence/inference; Practice selection and saved feedback. Add concise captions explaining what changed. Keep text legible, remove credentials/account chrome, avoid rapid flashing and provide a static image or description for each animation. Store intentional publication media separately from ignored QA screenshots. Do not add empty GIF links before assets exist.

## Submission checklist

- [ ] Recheck deadline, video length/platform, write-up, agent-link and sharing requirements with current organiser material.
- [ ] Finish the real deployed-version checks and record their actual outcome.
- [ ] Provide runnable judge setup: extension install, isolated backend identity and agent connection. Sharing the agent alone does not provision those.
- [ ] Confirm the intended agent link and account sharing/access policy; a builder settings URL is not a share link.
- [ ] Review source, notices and private data before any repository visibility/license decision.
- [ ] Record genuine output, edit clearly labelled waits, and verify public video access/audio from another viewer.
- [ ] Add real media and concise feature captions to the README after recording.

Suggested description: RabbitHole turns an intentionally collected browsing trail into an evidence-linked concept map and focused recall practice. A Chrome extension captures searches, articles and highlights; a Superhuman Go agent explains their connections and generates activities that remain available after the tabs close.
