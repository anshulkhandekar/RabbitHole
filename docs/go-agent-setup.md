# Connect RabbitHole to Go

The application implements one integration transport: MCP Streamable HTTP. Go configuration is manual and is not deployed by committing this repository. School agent-builder access and saving the existing RabbitHole agent instructions were verified in the signed-in browser. Actual connector execution remains unverified. An exact snapshot of the saved instructions is in `integrations/superhuman/live-agent-instructions.txt`.

## 1. Reachable, authenticated server

Deploy using [deployment.md](deployment.md). Go cannot reach your computer's localhost. The endpoint is `https://YOUR-SERVICE.onrender.com/mcp`; the public `/health` endpoint contains no research. All research/API/MCP requests require `Authorization: Bearer YOUR_PERSONAL_TOKEN`.

Generate a 32-byte random token using `npm run setup:local`, or the command in `.env.example`. The Render Blueprint can generate `RABBITHOLE_TOKEN` server-side for one owner. Use that generated token to connect the extension and Go. For multiple owners, set `RABBITHOLE_USERS` in the host environment to a JSON array of owner/token pairs. Use a distinct token for every person. Do not put tokens in source, screenshots, video, a shared agent prompt, or URLs. The server derives ownership from the token; knowing a session ID is insufficient. Revoking a user means removing/rotating their token and restarting the backend.

## 2. Create the connector

Following the [official MCP guide](https://coda.io/packs/build/latest/guides/blocks/mcp/):

1. Open the Packs page in your Superhuman Docs workspace.
2. Select **Create an MCP Connector** and enter your hosted `/mcp` URL.
3. Choose **Bearer token** authentication; enter your personal token when connecting the account. Verify the generated code declares `HeaderBearerToken` and your backend's network domain. If connector discovery asks for auth, provide the same token through its auth setup, never a URL parameter.
4. Create the connector, release it, and add the connection to your Go agent. Installation/sharing rights depend on your workspace. Later connector code changes need their own build and release. The server's runtime tool list is retrieved through MCP.
5. Confirm tools: `ListSessions`, `GetSession`, `SaveSessionAnalysis`. The first two advertise `readOnlyHint: true`; the write advertises `false` and should require confirmation. Do not change that annotation to bypass approval.

The generated connector route avoids a redundant local Pack build. The pinned official MCP SDK is in `package-lock.json`.

## 3. Configure the agent

Name: **RabbitHole**

Description and paste-ready instructions: [agent-instructions.md](../integrations/superhuman/agent-instructions.md). Copy the description separately, then the instructions after the divider. Attach the RabbitHole connector under Tools and Access. Save. No automatic trigger is required for manual chat use.

In extension Settings, enter your backend URL, your own token, and the real saved Go agent URL copied from the address bar. The verified current account chat URL is `https://go.superhuman.com/agents/72133`; its builder URL is a separate settings page. No invented prompt URL parameter is used.

## 4. Prove the first round trip

1. Install the extension, configure it, start on a real research tab, and capture one source. Use Sync & check Go.
2. Click Open in Go. The extension attempts to copy a session-specific prompt and opens the configured URL. Send/paste the prompt in the agent chat.
3. Observe a real GetSession call and source content, generation in Go, then SaveSessionAnalysis. Approve the write if prompted. The tool must return a version and pending count.
4. Return and click Sync & check Go. Verify the exact saved title, concepts, and evidence are displayed. Export JSON and compare its `analysis` to the actual tool call when debugging.
5. Record the run date, agent link, write approval behavior, and result in status.md. Only then mark Gate A live-verified.

Normal processing requires **at least four actions after capture**: open Go, paste/send the prompt (one or two actions depending on clipboard and focus), approve the save if requested, then sync the extension. If paste and send are separate, that is five. Native Go focus/navigation or authentication can add actions. This count is the designed workflow, not an observed account measurement. The UI never says opening Go started reasoning.

## 5. Scheduling later

The official builder lists Scheduled, While writing, Email received/sent, and Slack mentioned/message triggers. Manual chat is an invocation path, not a configurable event trigger. First prove the manual loop. Then configure an available schedule in your account, test one pending batch, and record cadence, approvals, completion timestamp, and duplicate/no-op behavior. No cadence or unattended write behavior is assumed. Do not enable Slack by default.

MCP Apps are documented only in Go's web client. They are unnecessary here. This project has no direct Go invocation API, inbound webhook, internal endpoint, or browser-click automation workaround.
