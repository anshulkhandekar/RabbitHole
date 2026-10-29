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

The original integration obstacle was directionality: exposing MCP tools lets Go read and write RabbitHole, but does not establish a supported extension-to-Go invocation path. The implementation preserves this boundary and makes the handoff explicit. Current public beta/trigger capabilities and remaining uncertainty are documented in [platform findings](platform-findings.md); a supported adapter could replace the handoff without moving reasoning into the server.

The release prioritises reliable capture, recoverable saves, understandable practice and honest state over cross-session graphs, new activity types, unattended writes or a new authentication system. See [future work](future-work.md).
