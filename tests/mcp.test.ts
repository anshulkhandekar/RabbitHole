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
      new StreamableHTTPClientTransport(new URL(url + "/mcp?schema=2"), {
        requestInit: { headers: { Authorization: "Bearer " + token } },
      }),
    );
    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((t) => t.name),
      [
        "ListSessions",
        "GetSession",
        "SaveSessionAnalysis",
        "ValidateSessionAnalysis",
      ],
    );
    assert.equal(tools.tools[2].annotations?.readOnlyHint, false);
    // Rebuild support must be discoverable, not only accepted by direct calls.
    const input = tools.tools[2].inputSchema.properties as any;
    assert.deepEqual(input.intent.enum, ["incremental", "rebuild"]);
    assert.ok(input.overview.properties.rootConceptId);
    assert.ok(input.concepts.items.properties.parentId);
    assert.ok(input.concepts.items.properties.evidence);
    assert.ok(input.studyItems.items.properties.type.enum.includes("matching"));
    assert.ok(input.studyItems.items.properties.pairs);
    assert.ok(input.studyItems.items.properties.choiceExplanations);
    const read = await client.callTool({
      name: "GetSession",
      arguments: { sessionId: "s1" },
    });
    const data = JSON.parse((read.content as any)[0].text);
    assert.equal(data.captures[0].id, "c1");
    assert.equal(tools.tools[3].annotations?.readOnlyHint, true);
    const invalid = await client.callTool({
      name: "ValidateSessionAnalysis",
      arguments: { ...analysis(), processedCaptureIds: ["mistyped-capture"] },
    });
    assert.equal(invalid.isError, true);
    assert.match((invalid.content as any)[0].text, /mistyped-capture/);
    const checked = await client.callTool({
      name: "ValidateSessionAnalysis",
      arguments: analysis(),
    });
    assert.equal(checked.isError, undefined);
    assert.equal(JSON.parse((checked.content as any)[0].text).valid, true);
    assert.equal(db.get("alice", "s1").version, 0);
    assert.equal(db.get("alice", "s1").analysis, null);
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
    const rich = {
      ...analysis(),
      expectedVersion: 1,
      intent: "rebuild",
      processedCaptureIds: [],
      overview: {
        rootConceptId: "n1",
        summary: "A synthetic learning guide.",
        takeaways: ["Independent operations can proceed together."],
        route: ["n1", "n2"],
      },
      concepts: analysis().concepts.map((c, i) => ({
        ...c,
        ...(i === 1 ? { parentId: "n1" } : {}),
        evidence: [
          {
            captureId: "c1",
            quote:
              "A GPU uses parallel execution to process many operations at once.",
          },
        ],
      })),
    };
    const rebuilt = await client.callTool({
      name: "SaveSessionAnalysis",
      arguments: rich,
    });
    assert.equal(rebuilt.isError, undefined);
    const guide = await client.callTool({
        name: "GetSession",
        arguments: { sessionId: "s1" },
      }),
      actual = JSON.parse((guide.content as any)[0].text);
    assert.equal(actual.version, 2);
    assert.deepEqual(actual.analysis.overview, rich.overview);
    assert.equal(actual.analysis.concepts[1].parentId, "n1");
    assert.equal(actual.pending, 0);
  } finally {
    await client.close();
    await new Promise<void>((r, e) =>
      server.close((err) => (err ? e(err) : r())),
    );
    db.db.close();
  }
});
