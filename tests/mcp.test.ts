import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../apps/server/src/app";
import { setup, analysis, capture } from "./support";
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
      new StreamableHTTPClientTransport(new URL(url + "/mcp?schema=5"), {
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
        "SaveValidatedAnalysis",
        "ValidateSessionQuestions",
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
    for (const field of ["claim", "why", "steps", "buildsOn", "nextSearch"])
      assert.ok(
        input.concepts.items.properties[field],
        `discoverable concept field: ${field}`,
      );
    for (const field of ["hints", "variantOf"])
      assert.ok(
        input.studyItems.items.properties[field],
        `discoverable practice field: ${field}`,
      );
    assert.match(tools.tools[1].description!, /removedCaptureIds/);
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
    const refs = data.processingDefaults.processedCaptureIds;
    assert.equal(refs.length, 1);
    assert.equal(data.captures[0].ref, refs[0]);
    const refPayload = analysis();
    refPayload.processedCaptureIds = refs;
    for (const item of [
      ...refPayload.concepts,
      ...refPayload.edges,
      ...refPayload.studyItems,
    ])
      item.captureIds = refs;
    const checked = await client.callTool({
      name: "ValidateSessionAnalysis",
      arguments: refPayload,
    });
    assert.equal(checked.isError, undefined);
    assert.equal(JSON.parse((checked.content as any)[0].text).valid, true);
    const receipt = JSON.parse((checked.content as any)[0].text);
    assert.ok(receipt.validationId);
    assert.equal(db.get("alice", "s1").version, 0);
    assert.equal(db.get("alice", "s1").analysis, null);
    const approvalLogs: unknown[] = [],
      originalInfo = console.info;
    let wrongSession: Awaited<ReturnType<typeof client.callTool>>;
    try {
      console.info = (...args: unknown[]) => {
        approvalLogs.push(...args);
      };
      wrongSession = await client.callTool({
        name: "SaveValidatedAnalysis",
        arguments: { ...receipt.saveArguments, sessionId: "wrong-session" },
      });
    } finally {
      console.info = originalInfo;
    }
    assert.equal(
      JSON.stringify(approvalLogs).includes(receipt.title),
      false,
      "retry arguments must not put a private guide title in operational logs",
    );
    assert.equal(wrongSession.isError, true);
    const wrongMessage = JSON.parse(
      (wrongSession.content as any)[0].text,
    ).error;
    assert.match(wrongMessage, /Draft session mismatch.*Nothing was saved/);
    assert.deepEqual(
      JSON.parse(wrongMessage.split("saveArguments: ")[1]),
      receipt.saveArguments,
    );
    assert.equal(db.get("alice", "s1").version, 0);
    const saved = await client.callTool({
      name: "SaveValidatedAnalysis",
      arguments: {
        sessionId: "s1",
        validationId: receipt.validationId,
        title: receipt.title,
      },
    });
    assert.equal(saved.isError, undefined);
    const stored = await (
      await fetch(url + "/api/sessions/s1", {
        headers: { Authorization: "Bearer " + token },
      })
    ).json();
    assert.deepEqual(stored.analysis, analysis());
    assert.equal(stored.version, 1);
    const replayed = await client.callTool({
      name: "SaveValidatedAnalysis",
      arguments: {
        sessionId: "s1",
        validationId: receipt.validationId,
        title: receipt.title,
      },
    });
    assert.equal(replayed.isError, undefined);
    assert.equal(db.get("alice", "s1").version, 1);
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
    const questions = await client.callTool({
      name: "ValidateSessionQuestions",
      arguments: {
        sessionId: "s1",
        expectedVersion: 2,
        questions: [
          {
            id: "added_question",
            type: "connection",
            prompt: "Why does independence matter?",
            answer: "Independent operations can proceed together.",
            conceptIds: ["n1"],
          },
        ],
      },
    });
    assert.equal(questions.isError, undefined);
    const questionReceipt = JSON.parse((questions.content as any)[0].text);
    assert.equal(db.get("alice", "s1").version, 2);
    const questionSave = await client.callTool({
      name: "SaveValidatedAnalysis",
      arguments: questionReceipt.saveArguments,
    });
    assert.equal(questionSave.isError, undefined);
    assert.equal(
      db.get("alice", "s1").analysis!.studyItems.at(-1)!.captureIds[0],
      "c1",
    );
    for (let i = 2; i <= 15; i++)
      db.capture(
        "alice",
        "s1",
        capture(`c${i}`, `Public synthetic source ${i}`),
      );
    const firstBatch = await client.callTool({
      name: "GetSession",
      arguments: { sessionId: "s1" },
    });
    const firstData = JSON.parse((firstBatch.content as any)[0].text);
    assert.equal(firstData.captures.length, 12);
    assert.equal(firstData.nextOffset, 12);
    assert.equal(firstData.processingDefaults.processedCaptureIds.length, 12);
    const lastBatch = await client.callTool({
      name: "GetSession",
      arguments: { sessionId: "s1", offset: firstData.nextOffset },
    });
    const lastData = JSON.parse((lastBatch.content as any)[0].text);
    assert.equal(lastData.captures.length, 2);
    assert.equal(lastData.nextOffset, null);
  } finally {
    await client.close();
    await new Promise<void>((r, e) =>
      server.close((err) => (err ? e(err) : r())),
    );
    db.db.close();
  }
});
