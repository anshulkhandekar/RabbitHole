# Connect RabbitHole to Go

Go calls the authenticated MCP Streamable HTTP endpoint. Git updates do not change the live agent's Instructions or release a connector. The canonical instructions are [agent-instructions.md](../integrations/superhuman/agent-instructions.md); `live-agent-instructions.txt` is a historical snapshot, not proof of the current live field.

## Backend and identity

Deploy a reachable HTTPS service using [deployment](deployment.md). Go cannot access your localhost. All research/API/MCP access requires a personal bearer token; `/health` is public and contains no research. Configure the extension and Go with tokens for the same owner. Session IDs alone never authorize access.

`npm run setup:local` creates ignored local credentials if absent. The Render Blueprint can generate a single-owner token server-side; multiple owners use RABBITHOLE_USERS as described in `.env.example`. Never put a token in a URL, shared prompt, screenshot or recording. Revocation means rotating/removing the token and restarting the backend.

## Connector — schema 8

1. Follow the [official MCP guide](https://coda.io/packs/build/latest/guides/blocks/mcp/) to create an MCP connector in the appropriate workspace.
2. Use [pack.ts](../integrations/superhuman/pack.ts), which declares the network domain and per-user HeaderBearerToken authentication. Its configured endpoint is `/mcp?schema=8` on the RabbitHole service. For another deployment, update the domain and origin together.
3. Build/release the connector and attach its account connection to the agent. Enter the personal token in the connection dialog. Installation and sharing depend on workspace rights.
4. Confirm six tools: ListSessions, GetSession, ValidateSessionAnalysis, ValidateSessionQuestions, SaveValidatedAnalysis and legacy SaveSessionAnalysis. Read tools advertise readOnlyHint true. Both save tools advertise false. Keep **Write: Always ask**; Read may be Always allow.

Schema revision is a discovery-cache key, not authentication. Bump it only when changing the tool contract, then verify actual discovery in a fresh chat. The current changes keep schema 8 and need **no new connector release** if schema 8 is already installed. Backend changes still require deployment.

The definition can be checked locally with `npx coda validate integrations/superhuman/pack.ts`. The Packs SDK is a development dependency; the production endpoint uses the MCP SDK.

## Agent and extension

Name the agent RabbitHole. Copy its description separately, then the Instructions text after the divider in [agent-instructions.md](../integrations/superhuman/agent-instructions.md). Attach the connector and save. Use this checkout (`rabbitv4-2`), not a sibling worktree or the historical live snapshot. No automatic trigger is required for the demonstrated manual flow.

In extension Settings enter the backend origin, owner token and actual saved agent/chat URL copied from Go. Do not invent a prompt query parameter or use the builder settings URL as a chat link.

## Prove the round trip

1. Capture public sources and wait for backend sync to finish. Send a batch with at least thirteen finds to exercise pagination.
2. Click Send to Go, paste/send the copied prompt and observe actual GetSession calls. GetSession returns up to twelve captures per page with stable short refs and processingDefaults. Go follows every nextOffset; twelve is not a run limit. New arrivals after submission remain pending.
3. Go reads the existing guide, creates the complete replacement and calls read-only ValidateSessionAnalysis. A question-only top-up uses ValidateSessionQuestions with new questions and saved concept IDs; source inheritance happens server-side.
4. Correct invalid evidence before approval. Exact-quote failures may include bounded same-source evidenceRepairs. Go must choose supporting text, preserve the complete guide and resubmit a corrected preflight. Instructions allow two corrected checks after the initial failure. Never automatically replace quotes or relax validation.
5. After successful validation, Go copies saveArguments verbatim into SaveValidatedAnalysis and requests normal approval. Check session identity and title on the card. The saved version and pending count are the receipt.
6. Verify the extension observes the newer version, displays the guide and reports remaining finds honestly. Re-read/export the saved analysis when diagnosing a mismatch. Inspect actual question quality and evidence relevance; automated validation does not establish them.

“Do not retype the guide” applies to saving the validated draft by reference. Corrected ValidateSessionAnalysis calls still need the complete guide. An unchanged failed write must not be repeated. Stale versions require reading/merging the current guide, then fresh validation.

Drafts are owner/session-bound, capped at 32 entries and expire after thirty minutes. Restart/eviction requires revalidation. Preflight never marks finds processed. Approval rechecks atomically; replay returns the prior receipt. Hidden/deleted evidence cannot support new questions. Legacy saves remain available for older clients.

## Limits and troubleshooting

Search-only trails support interests and gaps, not invented factual teaching. Capture a substantive article or highlight to support a learning guide. Inferred connections must remain labelled.

If tools or fields are absent, check the deployed backend and attached schema 8 connector before changing prompts. Updating Instructions alone cannot add tools. If a save fails, inspect its actionable error and current version rather than approving repeated unchanged writes. A waiting state cannot observe Go's chat errors directly; Check Go directs the user back after a stall.

The public builder offers several trigger types and describes beta availability. No supported authenticated extension-to-Go invocation path has been verified here. Scheduling cadence and unattended approval behaviour are not release claims. See [platform findings](platform-findings.md) and the [live checklist](release-checklist.md).
