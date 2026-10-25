# Connect RabbitHole to Go

The application implements one integration transport: MCP Streamable HTTP. Go configuration is manual and is not deployed by committing this repository. School agent-builder access and saving the existing RabbitHole agent instructions were verified in the signed-in browser. The private connector (Pack 74898, released v4) is authenticated and attached. A genuine GetSession → Go generation → approved SaveSessionAnalysis → extension display round trip was verified on October 24, 2026. An exact snapshot of the saved instructions is in `integrations/superhuman/live-agent-instructions.txt`.

## 1. Reachable, authenticated server

Deploy using [deployment.md](deployment.md). Go cannot reach your computer's localhost. The endpoint is `https://YOUR-SERVICE.onrender.com/mcp`; the public `/health` endpoint contains no research. All research/API/MCP requests require `Authorization: Bearer YOUR_PERSONAL_TOKEN`.

Generate a 32-byte random token using `npm run setup:local`, or the command in `.env.example`. The Render Blueprint can generate `RABBITHOLE_TOKEN` server-side for one owner. Use that generated token to connect the extension and Go. For multiple owners, set `RABBITHOLE_USERS` in the host environment to a JSON array of owner/token pairs. Use a distinct token for every person. Do not put tokens in source, screenshots, video, a shared agent prompt, or URLs. The server derives ownership from the token; knowing a session ID is insufficient. Revoking a user means removing/rotating their token and restarting the backend.

## 2. Create the connector

Following the [official MCP guide](https://coda.io/packs/build/latest/guides/blocks/mcp/):

1. Open the Packs page in your Superhuman Docs workspace.
2. Select **Create an MCP Connector** and enter your hosted `/mcp` URL.
3. Static bearer authentication was not discovered automatically in the live wizard. Use the validated [pack.ts](../integrations/superhuman/pack.ts) source, which declares per-user `HeaderBearerToken` and the backend network domain. Build and release the connector, then enter the personal token in its account connection dialog, never a URL parameter.
4. Create the connector, release it, and add the connection to your Go agent. Installation/sharing rights depend on your workspace. Later connector code changes need their own build and release. The server's runtime tool list is retrieved through MCP. Go was observed retaining the older parameter schema after a backend update, even in a fresh chat and after a connector-only rebuild. The v4 connector uses `/mcp?schema=2` to obtain fresh discovery from the same authenticated endpoint. Bump the schema revision when making tool-contract changes, build/release, and verify the actual fields in a fresh Go chat.
5. Confirm tools: `ListSessions`, `GetSession`, `SaveSessionAnalysis`. The first two advertise `readOnlyHint: true`; the write advertises `false` and should require confirmation. Do not change that annotation to bypass approval.

The released connector was also validated locally with `npx coda validate integrations/superhuman/pack.ts`. The official `@codahq/packs-sdk` is a development dependency; the production server uses the official MCP SDK. For this private connector, the documented setup route is `https://docs.superhuman.com/go/agent/setup/74898`. After connecting, search RabbitHole in the agent builder’s Add connections dialog. Read approval is Always allow; Write approval remains Always ask.

## 3. Configure the agent

Name: **RabbitHole**

Description and paste-ready instructions: [agent-instructions.md](../integrations/superhuman/agent-instructions.md). Copy the description separately, then the instructions after the divider. Attach the RabbitHole connector under Tools and Access. Save. No automatic trigger is required for manual chat use.

In extension Settings, enter your backend URL, your own token, and the real saved Go agent URL copied from the address bar. The verified current account chat URL is `https://go.superhuman.com/agents/72133`; its builder URL is a separate settings page. No invented prompt URL parameter is used.

## 4. Prove the first round trip

1. Install the extension, configure it, start on a real research tab, and capture one source. Wait for the synced status.
2. Click Send to Go. The extension attempts to copy a session-specific prompt and opens the configured URL. Send/paste the prompt in the agent chat.
3. Observe a real GetSession call and source content, generation in Go, then SaveSessionAnalysis. Approve the write if prompted. The tool must return a version and pending count.
4. Return to the extension; it automatically polls for the saved analysis. Verify the exact saved title, concepts, and evidence are displayed. Export JSON and compare its `analysis` to the actual tool call when debugging.
5. Record the run date, agent link, write approval behavior, and result in status.md. Only then mark Gate A live-verified.

The redesigned flow is Send to Go, paste, Send, then Approve if Go requests a write. Navigation/authentication may add actions. The extension then observes the saved version automatically. This handoff and polling were tested with a synthetic destination and saved fixture; the earlier live account test used the previous six-action UI (Sync, Open in Go, paste, Send, Approve, Sync). Opening Go never means reasoning has started.

## 5. Scheduling later

The official builder lists Scheduled, While writing, Email received/sent, and Slack mentioned/message triggers. Manual chat is an invocation path, not a configurable event trigger. First prove the manual loop. Then configure an available schedule in your account, test one pending batch, and record cadence, approvals, completion timestamp, and duplicate/no-op behavior. No cadence or unattended write behavior is assumed. Do not enable Slack by default.

MCP Apps are documented only in Go's web client. They are unnecessary here. This project has no direct Go invocation API, inbound webhook, internal endpoint, or browser-click automation workaround.

Live scheduling inspection: Custom exposes interval 1–30 with Hour/Day/Week/Month units. No minute unit was present. No schedule was saved; write confirmation and completion remain untested for scheduled runs. Manual chat is the verified workflow.

## Rebuild schema troubleshooting

If Go reports that `intent` is unavailable or a rebuild fails with “No new captures,” do not invent captures or remove the backend guard. Check that the installed connector uses the current release and open a fresh RabbitHole chat. A read-only schema diagnostic should expose top-level `intent` and `overview`, concept `parentId`/`evidence`, and matching `pairs`. Merely updating agent instructions or releasing identical connector code did not refresh the old schema in the observed run. The schema revision is not a credential; bearer authentication and Always ask for writes remain required.

Quote validation reports every invalid evidence path with item and capture IDs, without echoing source text. Fix only those excerpts after re-reading their captures, retain the rest of the complete guide, and retry against the current saved version. Validation failures remain atomic; they do not partially replace an existing guide.
