import { test } from "node:test";
import assert from "node:assert/strict";
import { worker } from "./worker-harness";
import { capture } from "./support";

test("only the latest unprocessed overview per tab, URL and session survives; tombstones still deduplicate", async () => {
  const url = "https://www.google.com/search?q=gpu";
  const app = worker({ id: 7, url });
  const id = (await app.request("start", { title: "GPUs" })).active;
  const save = (cid: string, text: string, tab = 7) =>
    app.fromTab(
      {
        type: "capture",
        capture: {
          ...capture(cid, text),
          url,
          sessionId: id,
          sourceType: "google_ai_overview",
        },
      },
      url,
      tab,
    );
  await app.fromTab(
    {
      type: "capture",
      capture: {
        ...capture("search", "gpu"),
        url,
        sessionId: id,
        sourceType: "search",
      },
    },
    url,
    7,
  );
  await save("o1", "A short overview");
  await save("o2", "A short overview that grew");
  assert.deepEqual(
    app.local.state.sessions[id].captures.map((c: any) => c.id),
    ["search", "o2"],
  );
  assert.equal(
    app.local.state.sessions[id].captures.at(-1).parentCaptureId,
    "search",
  );
  assert.ok(
    !app.local.state.queue.some(
      (q: any) => q.method === "POST" && q.body?.id === "o1",
    ),
  );
  assert.ok(
    app.local.state.queue.some(
      (q: any) => q.method === "DELETE" && q.path.endsWith("/o1"),
    ),
  );
  app.local.state.sessions[id].processed = ["o2"];
  await save("o3", "A newer completed overview");
  assert.equal(app.local.state.sessions[id].captures.length, 3);
  await app.content(url);
  await save("other-tab", "Different tab overview", 8);
  assert.equal(app.local.state.sessions[id].captures.length, 4);
  await app.request("capture-delete", { id, captureId: "o3" });
  assert.equal((await save("o4", "A newer completed overview")).ignored, true);
  assert.equal(
    (await save("o5", "A short overview that grew")).duplicate,
    true,
  );
});
