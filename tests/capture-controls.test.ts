import { test } from "node:test";
import assert from "node:assert/strict";
import { capture, analysis, setup } from "./support";
test("hidden captures leave Go's view and pending counts, and can return", () => {
  const db = setup();
  db.capture("alice", "s1", capture("c2", "An unrelated shopping page."));
  db.updateCapture("alice", "s1", "c2", { hidden: true });
  const batch = db.batch("alice", "s1");
  assert.deepEqual(
    batch.captures.map((c) => c.id),
    ["c1"],
  );
  assert.equal(batch.pending, 1);
  assert.deepEqual(batch.removedCaptureIds, ["c2"]);
  assert.equal((batch as any).hidden, undefined);
  assert.equal(db.list("alice")[0].pending, 1);
  assert.equal(db.batch("alice", "s1", 0, ["c2"]).captures.length, 0);
  db.updateCapture("alice", "s1", "c2", { hidden: false });
  assert.equal(db.batch("alice", "s1").pending, 2);
  db.db.close();
});
test("saves citing a hidden or deleted capture are rejected with the IDs", () => {
  const db = setup();
  db.capture("alice", "s1", capture("c2", "Another GPU source."));
  const a = analysis();
  a.processedCaptureIds = ["c1", "c2"];
  a.concepts[1].captureIds = ["c2"];
  db.updateCapture("alice", "s1", "c2", { hidden: true });
  assert.throws(
    () => db.validate("alice", a),
    /hid or deleted capture IDs: c2/,
  );
  db.removeCapture("alice", "s1", "c2");
  assert.throws(() => db.save("alice", a), /hid or deleted capture IDs: c2/);
  assert.equal(db.get("alice", "s1").version, 0);
  db.db.close();
});
test("deleting a capture removes it, keeps a tombstone, and blocks a queued retry", () => {
  const db = setup();
  db.save("alice", analysis());
  db.removeCapture("alice", "s1", "c1");
  const s = db.get("alice", "s1");
  assert.equal(s.captures.length, 0);
  assert.deepEqual(s.processed, []);
  assert.deepEqual(s.removed, ["c1"]);
  assert.equal(db.capture("alice", "s1", capture("c1")).duplicate, true);
  assert.equal(db.get("alice", "s1").captures.length, 0);
  assert.doesNotThrow(() => db.removeCapture("alice", "s1", "c1"));
  assert.throws(() => db.removeCapture("other", "s1", "c1"), /not found/);
  db.db.close();
});
test("tags can change after capture; buildsOn and variantOf must resolve", () => {
  const db = setup();
  db.updateCapture("alice", "s1", "c1", { tag: "confusing" });
  assert.equal(db.get("alice", "s1").captures[0].tag, "confusing");
  const bad = analysis() as any;
  bad.concepts[1].buildsOn = ["ghost"];
  assert.throws(() => db.validate("alice", bad), /buildsOn/);
  const variant = analysis() as any;
  variant.studyItems.push({
    ...variant.studyItems[0],
    id: "q2",
    variantOf: "q9",
  });
  assert.throws(() => db.validate("alice", variant), /variantOf/);
  const good = analysis() as any;
  good.concepts[1].buildsOn = ["n1"];
  good.concepts[1].claim = "Parallel execution runs many operations at once.";
  good.concepts[1].steps = ["Work is split.", "Pieces run together."];
  good.studyItems.push({ ...good.studyItems[0], id: "q2", variantOf: "q1" });
  assert.equal(db.save("alice", good).version, 1);
  db.db.close();
});
test("capture routes require the owner and drive hide, tag and delete over HTTP", async () => {
  const { createApp } = await import("../apps/server/src/app");
  const db = setup(),
    token = "a".repeat(64);
  const server = createApp(db, [
    { owner: "alice", token },
    { owner: "bob", token: "b".repeat(64) },
  ]).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const call = (method: string, path: string, body?: object, as = token) =>
    fetch(url + path, {
      method,
      headers: {
        Authorization: "Bearer " + as,
        "Content-Type": "application/json",
      },
      body: body && JSON.stringify(body),
    });
  try {
    assert.equal(
      (
        await call(
          "PATCH",
          "/api/sessions/s1/captures/c1",
          { hidden: true },
          "b".repeat(64),
        )
      ).status,
      404,
    );
    assert.equal(
      (await call("PATCH", "/api/sessions/s1/captures/c1", { hidden: "yes" }))
        .status,
      422,
    );
    const hidden = await call("PATCH", "/api/sessions/s1/captures/c1", {
      hidden: true,
      tag: "confusing",
    });
    assert.deepEqual(await hidden.json(), {
      captureId: "c1",
      hidden: true,
      tag: "confusing",
    });
    assert.equal(
      (await call("DELETE", "/api/sessions/s1/captures/c1")).status,
      200,
    );
    assert.equal(
      (await call("DELETE", "/api/sessions/s1/captures/c1")).status,
      200,
    );
    assert.equal(db.get("alice", "s1").captures.length, 0);
  } finally {
    server.close();
    db.db.close();
  }
});
