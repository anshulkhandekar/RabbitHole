import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../apps/server/src/app";
import { setup, analysis } from "./support";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
test("authenticated API and official MCP client complete read → validated write → exact persisted retrieval", async () => {
  const db = setup(),
    token = "a".repeat(64);
  const server = createApp(db, [
    { owner: "alice", token },
    { owner: "bob", token: "b".repeat(64) },
  ]).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address() as { port: number },
    url = `http://127.0.0.1:${address.port}`;
  const client = new Client({ name: "local-harness-not-Go", version: "1" });
  try {
    assert.equal((await fetch(url + "/api/sessions")).status, 401);
    assert.equal(
      (
        await fetch(url + "/api/sessions/s1", {
          headers: { Authorization: "Bearer " + "b".repeat(64) },
        })
      ).status,
      404,
    );
    await client.connect(
      new StreamableHTTPClientTransport(new URL(url + "/mcp"), {
        requestInit: { headers: { Authorization: "Bearer " + token } },
      }),
    );
    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((t) => t.name),
      ["ListSessions", "GetSession", "SaveSessionAnalysis"],
    );
    assert.equal(tools.tools[2].annotations?.readOnlyHint, false);
    const read = await client.callTool({
      name: "GetSession",
      arguments: { sessionId: "s1" },
    });
    const data = JSON.parse((read.content as any)[0].text);
    assert.equal(data.captures[0].id, "c1");
    const saved = await client.callTool({
      name: "SaveSessionAnalysis",
      arguments: analysis(),
    });
    assert.equal(saved.isError, undefined);
    const stored = await (
      await fetch(url + "/api/sessions/s1", {
        headers: { Authorization: "Bearer " + token },
      })
    ).json();
    assert.deepEqual(stored.analysis, analysis());
    assert.equal(stored.version, 1);
    const stale = await client.callTool({
      name: "SaveSessionAnalysis",
      arguments: analysis(),
    });
    assert.equal(stale.isError, true);
  } finally {
    await client.close();
    await new Promise<void>((r, e) =>
      server.close((err) => (err ? e(err) : r())),
    );
    db.db.close();
  }
});
