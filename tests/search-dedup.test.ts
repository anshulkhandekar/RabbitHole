import { test } from "node:test";
import assert from "node:assert/strict";
import { worker } from "./worker-harness";
import { capture, setup } from "./support";

const first =
  "https://www.google.com/search?q=how+to+optimize+mac+terminal&source=initial";
const reopened =
  "https://www.google.com/search?source=revisit&q=how%20to%20optimize%20mac%20terminal&sei=changed#results";
const search = (id: string, url: string) => ({
  ...capture(id, "how to optimize mac terminal"),
  sourceType: "search" as const,
  url,
});

test("reopening a search with changed Google URL parameters reuses its existing trail capture", async () => {
  const app = worker({ id: 7, url: first });
  const id = (await app.request("start")).active;
  await app.fromTab(
    {
      type: "capture",
      capture: { ...search("original", first), sessionId: id },
    },
    first,
    7,
  );
  await app.request("patch", { id, patch: { status: "paused" } });
  await app.request("open-source", { sessionId: id, captureId: "original" });
  await app.fromTab(
    { type: "reading-control", control: "resume" },
    reopened,
    101,
  );
  const result = await app.fromTab(
    {
      type: "capture",
      capture: { ...search("revisited", reopened), sessionId: id },
    },
    reopened,
    101,
  );
  assert.equal(result.duplicate, true);
  assert.equal(result.captureId, "original");
  assert.equal(app.local.state.sessions[id].captures.length, 1);
  assert.ok(
    !app.local.state.queue.some((q: any) => q.body?.id === "revisited"),
  );
});

test("backend search deduplication ignores URL variants but preserves new queries and article attribution", () => {
  const db = setup();
  try {
    db.capture("alice", "s1", search("original", first));
    const duplicate = db.capture("alice", "s1", search("revisited", reopened));
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.captureId, "original");
    db.capture("alice", "s1", {
      ...search("different", first + "x"),
      text: "another search",
    });
    db.capture("alice", "s1", {
      ...capture("articleA"),
      url: "https://research.example/page?version=1",
    });
    db.capture("alice", "s1", {
      ...capture("articleB"),
      url: "https://research.example/page?version=2",
    });
    assert.equal(db.get("alice", "s1").captures.length, 5);
    assert.throws(
      () =>
        db.capture("alice", "s1", {
          ...search("original", first),
          text: "changed query",
        }),
      /different content/,
    );
  } finally {
    db.db.close();
  }
});
