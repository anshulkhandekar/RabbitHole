import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createApp } from "../apps/server/src/app";
import { setup, analysis } from "./support";

test("MCP returns copyable quote repairs without logging source text and still requires validated write approval", async () => {
  const db = setup(),
    token = "a".repeat(64),
    client = new Client({ name: "quote-recovery-fixture", version: "1" });
  const server = createApp(db, [{ owner: "alice", token }]).listen(
    0,
    "127.0.0.1",
  );
  await new Promise<void>((r) => server.once("listening", r));
  const log: string[] = [],
    originalInfo = console.info;
  console.info = (...args) => {
    log.push(args.join(" "));
  };
  try {
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL(
          `http://127.0.0.1:${(server.address() as any).port}/mcp?schema=8`,
        ),
        { requestInit: { headers: { Authorization: `Bearer ${token}` } } },
      ),
    );
    const payload: any = analysis();
    payload.concepts[0].evidence = [
      {
        captureId: "c1",
        quote: "A GPU computes all the operations simultaneously.",
      },
    ];
    const failed = await client.callTool({
      name: "ValidateSessionAnalysis",
      arguments: payload,
    });
    assert.equal(failed.isError, true);
    const error = JSON.parse((failed.content as any)[0].text);
    const quote = error.details?.evidenceRepairs[0].candidates[0];
    assert.equal(
      quote,
      "A GPU uses parallel execution to process many operations at once.",
    );
    assert.ok(!log.join(" ").includes(quote));
    assert.equal(db.get("alice", "s1").version, 0);
    payload.concepts[0].evidence[0].quote = quote;
    const checked = await client.callTool({
      name: "ValidateSessionAnalysis",
      arguments: payload,
    });
    assert.ok(!checked.isError);
    const receipt = JSON.parse((checked.content as any)[0].text);
    assert.equal(db.get("alice", "s1").version, 0, "preflight never saves");
    const saved = await client.callTool({
      name: "SaveValidatedAnalysis",
      arguments: receipt.saveArguments,
    });
    assert.ok(!saved.isError);
    assert.equal(
      db.get("alice", "s1").analysis!.concepts[0].evidence![0].quote,
      quote,
    );
  } finally {
    console.info = originalInfo;
    await client.close();
    await new Promise<void>((r) => server.close(() => r()));
    db.db.close();
  }
});
