# Setup and deployment

Use a single Render Node web service with a persistent disk. A paid service/disk is required; review Render's actual plan and price before provisioning. This repository does not incur hosting charges by itself.

1. Connect the repository in Render and create a Blueprint from `render.yaml`. Review the service plan and disk cost before confirming.
2. The Blueprint generates `RABBITHOLE_TOKEN` on Render and sets `RABBITHOLE_OWNER=anshul`. In a manual service form, use Generate for the token; keep it private. Multi-owner deployments can instead use the `RABBITHOLE_USERS` JSON array in `.env.example`. No local credential needs to be uploaded to Render.
3. Confirm `DATABASE_PATH=/var/data/rabbithole.sqlite` and a mounted persistent disk at `/var/data`. Never use free/ephemeral disk for the database.
4. Wait for the `/health` check. Configure the extension with the service origin and configure Go with its `/mcp` endpoint.
5. Test unauthorized requests (401), capture sync, Go read/write, restart persistence, then incremental processing. Deployment is unverified until those checks actually run.

One process/instance writes SQLite. Do not horizontally scale this deployment. The schema initializes idempotently on startup. Before schema changes, take a backup. Use SQLite's online backup API or a host snapshot; copying only the main database while its WAL is active is not a dependable backup.

The token workflow is a prototype compromise: no OAuth login, end-user sign-up, automatic provisioning, or account recovery. Give reviewers an isolated owner/token using intentionally collected public sources. Sharing the agent does not provision backend access or install the extension.

For local use: `npm run setup:local`, `npm start`. Local backend data persists under ignored `data/`. The local backend works with the extension, but Go requires public HTTPS access. Do not describe the localhost setup as a verified Go integration.

## Manual dashboard setup

Connecting the repository in Render’s Web Service wizard does not automatically apply render.yaml. Copy the build command, Node version, environment variables, disk mount, database path, and health check explicitly, or create the service as a Blueprint instead. Use `npm ci --include=dev && npm run build`, not the autofilled `npm install; npm run build`: npm ci clears native dependency binaries cached under a different Node version. After changing NODE_VERSION, rebuild before testing startup.

## Superhuman Go

Go calls the authenticated MCP Streamable HTTP endpoint. Git updates do not change the live agent Instructions or release a connector. The canonical configuration is [agent-instructions.md](../integrations/superhuman/agent-instructions.md).

## Backend and identity

Deploy a reachable HTTPS service using the deployment steps above. Go cannot access your localhost. All research/API/MCP access requires a personal bearer token; `/health` is public and contains no research. Configure the extension and Go with tokens for the same owner. Session IDs alone never authorize access.

`npm run setup:local` creates ignored local credentials if absent. The Render Blueprint can generate a single-owner token server-side; multiple owners use RABBITHOLE_USERS as described in `.env.example`. Never put a token in a URL, shared prompt, screenshot or recording. Revocation means rotating/removing the token and restarting the backend.

## Connector — schema 8

1. Follow the [official MCP guide](https://coda.io/packs/build/latest/guides/blocks/mcp/) to create an MCP connector in the appropriate workspace.
2. Use [pack.ts](../integrations/superhuman/pack.ts), which declares the network domain and per-user HeaderBearerToken authentication. Its configured endpoint is `/mcp?schema=8` on the RabbitHole service. For another deployment, update the domain and origin together.
3. Build/release the connector and attach its account connection to the agent. Enter the personal token in the connection dialog. Installation and sharing depend on workspace rights.
4. Confirm six tools: ListSessions, GetSession, ValidateSessionAnalysis, ValidateSessionQuestions, SaveValidatedAnalysis and legacy SaveSessionAnalysis. Read tools advertise readOnlyHint true. Both save tools advertise false. Keep **Write: Always ask**; Read may be Always allow.

Schema revision is a discovery-cache key, not authentication. Bump it only when changing the tool contract, then verify actual discovery in a fresh chat. Instruction-only or UI-only changes need **no new connector release** if schema 8 is already installed. Backend changes still require deployment.

The definition can be checked locally with `npx coda validate integrations/superhuman/pack.ts`. The Packs SDK is a development dependency; the production endpoint uses the MCP SDK.

## Agent and extension

Name the agent RabbitHole. Copy its description separately, then the Instructions text after the divider in [agent-instructions.md](../integrations/superhuman/agent-instructions.md). Attach the connector and save. Use the instructions from the same checkout as your installed build. No automatic trigger is required for the demonstrated manual flow.

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

The public builder offers several trigger types and describes beta availability. No supported authenticated extension-to-Go invocation path has been verified here. Scheduling cadence and unattended approval behaviour are not release claims. See [design decisions](design.md) and [manual acceptance testing](testing.md#manual-acceptance).

## Updating an installation

Deploy server changes and confirm the intended commit is live. Build and reload the extension, then refresh existing research and Go tabs. Update live agent Instructions separately when the canonical instructions change. Release the connector only for tool-contract/discovery changes. Keep Write approval at Always ask. Validate the deployed integration using the [manual acceptance checks](testing.md#manual-acceptance).
