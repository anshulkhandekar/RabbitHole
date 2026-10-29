# Design decisions and tradeoffs

| Decision                                        | Why it fits this build                                                               | Cost / boundary                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Scoped Chrome collection                        | Preserves the actual research trail without repeated uploads                         | Needs website permission and explicit inclusion; lineage cannot judge relevance |
| Go owns generation                              | Uses the user's connected agent for synthesis and question creation                  | Model behaviour and platform availability require real end-to-end checks        |
| Explicit copy/open/send handoff                 | Uses an established user path without undocumented invocation endpoints              | Extra user action; opening Go is not proof a run started                        |
| Read-only preflight, then approval by reference | Catches errors before a write card and avoids retyping a large guide                 | Draft cache is temporary; source/version changes require revalidation           |
| Strict evidence checks                          | Rejects nonexistent sources and non-exact quotations atomically                      | A quotation can still be irrelevant; semantic support needs inspection          |
| Visible projection for question top-ups         | Hidden sources cannot support new questions while remaining recoverable in the guide | Unsupported targets need unhide/rebuild rather than relaxed checks              |
| Durable local queue and optimistic versions     | Keeps captures through temporary disconnection and prevents stale overwrites         | Permanent failures can need intervention; stale reviews remain device-only      |
| SQLite, one persistent instance                 | Small operational footprint with transactional saves                                 | No horizontal scale; backups and durable storage are operational duties         |
| Static owner tokens                             | Simple extension/Go identity for a controlled prototype                              | No sign-up, OAuth, automated recovery or device revocation UI                   |
| Derived practice state                          | Immediate saved-key feedback, confidence and hint-aware review                       | No scientifically calibrated memory curve or learning-outcome evidence          |
| Deterministic map geometry                      | Stable source-depth context and inspectable saved relationships                      | Dense graphs can still cross; visual proximity is not a new claim               |

The original integration obstacle was directionality: exposing MCP tools lets Go read and write RabbitHole, but does not establish a supported extension-to-Go invocation path. The implementation preserves this boundary and makes the handoff explicit. Current public beta/trigger capabilities and remaining uncertainty are documented in the platform references below; a supported adapter could replace the handoff without moving reasoning into the server.

The release prioritises reliable capture, recoverable saves, understandable practice and honest state over cross-session graphs, new activity types, unattended writes or a new authentication system.

## Learning design

RabbitHole addresses a practical gap: research can feel familiar while the relationships remain difficult to reconstruct. Automatic collection reduces the need to upload everything again. A map externalizes the relationships while keeping the actual sources nearby. The map is not proof of understanding, and Go's inference is labeled separately from direct support.

The current flow offers a topic hub after the guide, with explicit New, Review and medium/hard readiness lanes. The default quiz asks the user to apply a mechanism or distinguish plausible alternatives, then reveals the saved explanation and per-choice reasons when supplied by Go. Matching checks saved idea–meaning pairs. A matching answer key or quiz index establishes agreement with saved content; it does not prove that content is semantically correct or that learning improved.

Optional Explain the connection and flashcards remain for users who want them. Self-ratings are explicitly user judgments; the UI does not pretend to grade arbitrary prose as AI. Fresh personalized critique uses the explicit Go handoff. Attempts persist with the analysis version; materially rewritten activities should receive new IDs so old attempts are not misrepresented as answers to different questions.

User testing favoured a 2×2 quiz with plausible misconception distractors over mandatory self-assessment. Current generation instructions request easy understanding, medium application and hard transfer questions across supported main topics, plus retry siblings within the bank limit. Even easy choices should require reasoning. Topic/count/difficulty controls make top-up intent explicit; they do not guarantee that Go produces equally strong questions. There is no validated spaced-repetition scheduler or measured learning-gain claim.

Quality review before the demo: choose a real edge, read its evidence, confirm the verb means something, try the prompt without the answer, and verify the model answer does not add unsupported causal claims. If the evidence is thin, a gap and useful next search are better than a confident invented connection.

Unused variantOf siblings are reserved retry versions, not unanswered original questions. Harder availability and readiness are separate: a saved apply/transfer question can still be locked by basic performance, and answered harder questions are not missing questions. Checked attempts persist before Continue. Hint-assisted and guessed correct answers remain distinct from strong recall. Usability and content-quality evaluation must assess whether the labels and questions make sense without developer explanation.

## Go invocation: confirmed scope and uncertainty

Checked October 29 against the official [agent-builder guide](https://help.superhuman.com/hc/en-us/articles/47453035724685-Create-and-configure-agents-with-the-agent-builder) and the August 19 [Packs-to-connectors update](https://head.coda.io/packs/build/latest/blog/2026/08/19/agents-are-connectors/). The builder is described as beta, with availability varying by plan. It documents scheduled, writing, mail and Slack triggers. Packs provide connectors that agents compose; a connector is not itself a chat destination.

RabbitHole has not established a supported public authenticated API for its third-party Chrome extension to start an agent run with a session payload. This is an implementation/access finding, not proof that Superhuman has no such private or partner capability. Beta access and SDK evolution may provide a future path, but compatibility and permissions require a real integration test. The current release copies a prompt, opens the configured Go conversation and relies on the user to send it; normal write approval remains required.

## Future improvements

These are candidates, not shipped features or commitments.

1. **Supported Go invocation.** Validate an official authenticated API/trigger or partner SDK in an accessible account. Keep normal write approval and honest pending/error states; avoid internal endpoints or synthetic browser clicks. Public beta capability alone does not prove the required API exists.
2. **Content-quality evaluation.** Build a diverse public-source rubric for mechanism explanations, cross-source reasoning, plausible distractors, difficulty and genuine transfer. Review exact-quote relevance as well as syntax. Compare guide usefulness with ordinary chat summaries; do not infer learning gains from quiz correctness.
3. **Cross-session learning.** Consider related-trail discovery and spaced review after within-session practice is proven. Cross-session graphs and a calibrated review scheduler are out of the current release.
4. **Capture robustness.** Broaden conservative Overview extraction against current Google variants, improve article completeness and show extraction quality. Preserve manual selection and user-controlled tab inclusion.
5. **Identity and operations.** Replace personal static tokens with appropriate sign-in/provisioning, device revocation and recoverable accounts. Add supported backup/restore and observability without logging private source text. Move beyond single-instance SQLite only when actual usage requires it.
6. **Export and accessibility.** Evaluate import/restore, richer portable guides and broader assistive-technology testing. The current JSON export is not an import workflow.
