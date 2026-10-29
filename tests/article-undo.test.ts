import { test } from "node:test";
import assert from "node:assert/strict";
import { worker } from "./worker-harness";
import { capture } from "./support";

test("article Undo removes the exact capture, queues deletion and prevents automatic recapture", async () => {
  const url = "https://research.example/article",
    app = worker({ id: 7, url });
  const id = (await app.request("start")).active;
  const c = { ...capture("article1"), sessionId: id, url };
  const result = await app.fromTab({ type: "capture", capture: c }, url, 7);
  assert.equal(result.captureId, "article1");
  const undone = await app.fromTab(
    { type: "reading-undo", sessionId: id, captureId: result.captureId },
    url,
    7,
  );
  assert.equal(undone.removed, true);
  assert.equal(app.local.state.sessions[id].captures.length, 0);
  assert.ok(app.local.state.sessions[id].removed.includes("article1"));
  assert.ok(
    app.local.state.queue.some(
      (q: any) => q.method === "DELETE" && q.path.endsWith("/article1"),
    ),
  );
  assert.ok(
    !app.local.state.queue.some(
      (q: any) => q.method === "POST" && q.body?.id === "article1",
    ),
  );
  assert.equal(
    (
      await app.fromTab(
        { type: "capture", capture: { ...c, id: "article2" } },
        url,
        7,
      )
    ).ignored,
    true,
  );
  assert.equal(
    (
      await app.fromTab(
        { type: "reading-undo", sessionId: id, captureId: "article1" },
        url,
        7,
      )
    ).removed,
    true,
  );
  assert.equal(
    app.local.state.queue.filter((q: any) => q.method === "DELETE").length,
    1,
  );
});

test("article Undo cannot delete a different page, a highlight or another session", async () => {
  const url = "https://research.example/article",
    app = worker({ id: 7, url });
  const id = (await app.request("start")).active;
  await app.fromTab(
    {
      type: "capture",
      capture: {
        ...capture("highlight"),
        sourceType: "highlight",
        sessionId: id,
        url,
      },
    },
    url,
    7,
  );
  for (const [sessionId, captureId, page] of [
    [id, "highlight", url],
    ["other", "highlight", url],
    [id, "highlight", "https://elsewhere.example/"],
  ])
    assert.ok(
      (
        await app.fromTab(
          { type: "reading-undo", sessionId, captureId },
          page,
          7,
        )
      ).error,
    );
  assert.equal(app.local.state.sessions[id].captures.length, 1);
});
