# Design decisions and tradeoffs

## Product principle: preserve natural research

RabbitHole starts with an observation about the experience of researching: people follow a question across searches, articles, references and selected passages. Deciding which sources deserve attention and comparing their explanations are part of the work. The product should preserve that process with little extra interaction.

Capture is the core experience. A session establishes intent, included tabs establish scope, and the trail keeps the actual searches, bounded page text and highlights. The sidebar is available when useful; a small reading indicator lets it stay closed. Pause, exclusion, deletion and quick Undo give the user control over mistakes. Observable tab lineage supports browsing continuity without claiming to classify a page's relevance.

The design removes repetitive collection work while keeping source selection and reading with the user. It aims to leave room for questions, uncertainty and independent reasoning. Effort alone is not a learning outcome: an unproductive search can waste attention, and easier explanations can be useful. No measured retention advantage is claimed.

Summary, Map and Practice are follow-up experiences built on the same captured trail. They should help users examine and revisit their work without making them adopt every feature. Capture quality, low interruption and recoverability remain release priorities alongside the quality of generated output.

## Portability is part of the product

Once a guide is saved, Markdown export includes its summary, takeaways, idea explanations, available idea quotations, quiz questions and visible non-search source links. The resulting text is usable outside the application. Idea links use wiki-link syntax, so their navigation depends on the receiving editor; ordinary source URLs remain inspectable.

JSON export preserves the complete selected session and is available before analysis. It is the choice for keeping raw captures, queries and attempts; Markdown is the choice for reading and editing the saved guide. Anki CSV and copied Quizlet import text serve study workflows. These are one-way exports, not an implemented import/restore system or a claim that every application preserves all structure.

| Decision                                        | Why it fits this build                                                               | Cost / boundary                                                                 |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Scoped Chrome collection                        | Preserves the actual research trail while users browse normally                      | Needs website permission and explicit inclusion; lineage cannot judge relevance |
| Go owns generation                              | Uses the user's connected agent for synthesis and question creation                  | Model behavior and platform availability require real end-to-end checks         |
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

Release priorities are reliable, quiet capture; clear collection boundaries; recoverable data; portable output; and useful reflection on the sources actually inspected.

## Learning design

The intended learning sequence begins with investigating a question and reading actual sources, followed by reflection and practice. A saved trail makes that work available to revisit; a map externalizes proposed relationships while keeping their sources nearby. The map is not proof of understanding, and Go's inference is labeled separately from direct support.

The current flow offers a topic hub after the guide, with explicit New, Review and medium/hard readiness lanes. The default quiz asks the user to apply a mechanism or distinguish plausible alternatives, then reveals the saved explanation and per-choice reasons when supplied by Go. Matching checks saved idea–meaning pairs. A matching answer key or quiz index establishes agreement with saved content; it does not prove that content is semantically correct or that learning improved.

Optional Explain the connection and flashcards remain for users who want them. Self-ratings are explicitly user judgments; the UI does not pretend to grade arbitrary prose as AI. Fresh personalized critique uses the explicit Go handoff. Attempts persist with the analysis version; materially rewritten activities should receive new IDs so old attempts are not misrepresented as answers to different questions.

User testing favored a 2×2 quiz with plausible misconception distractors over mandatory self-assessment. Current generation instructions request easy understanding, medium application and hard transfer questions across supported main topics, plus retry siblings within the bank limit. Even easy choices should require reasoning. Topic/count/difficulty controls make top-up intent explicit; they do not guarantee that Go produces equally strong questions. There is no validated spaced-repetition scheduler or measured learning-gain claim.

Quality review before the demo: choose a real edge, read its evidence, confirm the verb means something, try the prompt without the answer, and verify the model answer does not add unsupported causal claims. If the evidence is thin, a gap and useful next search are better than a confident invented connection.

Unused variantOf siblings are reserved retry versions, not unanswered original questions. Harder availability and readiness are separate: a saved apply/transfer question can still be locked by basic performance, and answered harder questions are not missing questions. Checked attempts persist before Continue. Hint-assisted and guessed correct answers remain distinct from strong recall. Usability and content-quality evaluation must assess whether the labels and questions make sense without developer explanation.

## Go invocation: confirmed scope and uncertainty

Checked October 29 against the official [agent-builder guide](https://help.superhuman.com/hc/en-us/articles/47453035724685-Create-and-configure-agents-with-the-agent-builder) and the August 19 [Packs-to-connectors update](https://head.coda.io/packs/build/latest/blog/2026/08/19/agents-are-connectors/). The builder is described as beta, with availability varying by plan. It documents scheduled, writing, mail and Slack triggers. Packs provide connectors that agents compose; a connector is not itself a chat destination.

RabbitHole has not established a supported public authenticated API for its third-party Chrome extension to start an agent run with a session payload. This is an implementation/access finding, not proof that Superhuman has no such private or partner capability. Beta access and SDK evolution may provide a future path, but compatibility and permissions require a real integration test. The current release copies a prompt, opens the configured Go conversation and relies on the user to send it; normal write approval remains required.

## Future improvements

These extend the capture-first workflow. They are candidates, not shipped features or commitments, and their implementation effort has not been estimated here.

1. **Broader capture coverage.** Improve article completeness, extraction feedback and support for changing page layouts and Google Overview variants. Keep manual selection, explicit tab inclusion and low interruption as fallbacks and priorities.
2. **Local-file input and portable research.** Add user-selected documents alongside web research, with reliable text extraction and source identity so evidence remains traceable. Extend exports and evaluate import/restore without weakening validation or discarding original context. Local-file upload is not implemented today.
3. **Spaced review.** Help users return to earlier investigations and practice over time. Due dates, review scheduling and persisted progress need evaluation; the existing within-session practice state is not a spaced-repetition scheduler. Cross-session connections are another possible extension.
4. **Processing and learning quality.** Evaluate whether summaries explain mechanisms and tradeoffs, whether quotations support their claims, and whether questions require reasoning. Test capture usability and interruption as well as generated output. Measure usefulness and retention before making learning-outcome claims.
5. **Supported Go invocation.** Validate an official authenticated API/trigger or partner SDK in an accessible account. Preserve normal write approval and honest pending/error states. Public beta availability alone does not establish the required extension invocation path.
6. **Identity and recovery.** Improve account provisioning, device revocation, backups and cross-profile recovery. Isolate a missing-session failure so unrelated queued work can continue, with explicit recovery/discard controls. The current queue can still require manual intervention; do not silently recreate deleted research. Move beyond single-instance SQLite when usage requires it.
7. **Accessibility.** Broaden assistive-technology testing across quiet capture, session navigation, maps and practice. Keep readable exported text and non-graph navigation available.
