import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "../apps/server/src/store";
import { capture, analysis, setup } from "./support";
test("ownership protects reads, writes, export, and deletion", () => {
  const db = setup();
  for (const fn of [
    () => db.get("other", "s1"),
    () => db.patch("other", "s1", { title: "stolen" }),
    () => db.capture("other", "s1", capture("c2")),
    () => db.save("other", analysis()),
    () => db.delete("other", "s1"),
  ])
    assert.throws(fn, /not found/);
  assert.equal(db.list("other").length, 0);
  db.db.close();
});
test("retried create and captures are idempotent; same text keeps different source attribution", () => {
  const db = setup();
  assert.equal(
    db.create("alice", { id: "s1", title: "Retry" }).title,
    "Research",
  );
  assert.equal(db.capture("alice", "s1", capture("c1")).duplicate, true);
  assert.equal(db.capture("alice", "s1", capture("retry")).duplicate, true);
  db.capture("alice", "s1", {
    ...capture("c2"),
    url: "https://other.example/article",
  });
  assert.equal(db.get("alice", "s1").captures.length, 2);
  assert.throws(
    () => db.capture("alice", "s1", { ...capture("c1"), text: "different" }),
    /different content/,
  );
  db.db.close();
});
test("atomic save preserves captures arriving during processing and rejects stale/retried save", () => {
  const db = setup();
  const snapshot = db.batch("alice", "s1");
  db.capture("alice", "s1", capture("c2", "A new source"));
  db.save("alice", analysis());
  const s = db.get("alice", "s1");
  assert.equal(snapshot.version, 0);
  assert.equal(s.version, 1);
  assert.deepEqual(s.processed, ["c1"]);
  assert.equal(db.batch("alice", "s1").captures[0].id, "c2");
  assert.throws(() => db.save("alice", analysis()), /Stale/);
  assert.equal(db.get("alice", "s1").version, 1);
  db.db.close();
});
test("invalid graph/evidence/quiz inputs cannot change analysis or processed markers", () => {
  const db = setup();
  for (const mutate of [
    (a: any) => (a.edges[0].source = "ghost"),
    (a: any) => (a.concepts[0].captureIds = ["ghost"]),
    (a: any) => (a.processedCaptureIds = ["ghost"]),
    (a: any) => (a.studyItems[0].correctIndex = 8),
    (a: any) => a.concepts.push(a.concepts[0]),
  ]) {
    const a = analysis();
    mutate(a);
    assert.throws(() => db.save("alice", a));
    assert.equal(db.get("alice", "s1").version, 0);
    assert.deepEqual(db.get("alice", "s1").processed, []);
  }
  db.db.close();
});
test("incremental merge retains attempts and stable concept IDs", () => {
  const db = setup();
  db.save("alice", analysis());
  db.review("alice", "s1", {
    id: "r1",
    studyId: "q1",
    analysisVersion: 1,
    rating: "again",
    choice: 0,
    timestamp: new Date().toISOString(),
  });
  db.capture("alice", "s1", capture("c2", "next"));
  const next = analysis();
  next.expectedVersion = 1;
  next.processedCaptureIds = ["c2"];
  db.save("alice", next);
  assert.equal(db.get("alice", "s1").attempts.length, 1);
  assert.equal(db.get("alice", "s1").analysis?.concepts[0].id, "n1");
  assert.throws(
    () =>
      db.review("alice", "s1", {
        id: "r2",
        studyId: "q1",
        analysisVersion: 1,
        rating: "again",
        timestamp: new Date().toISOString(),
      }),
    /changed/,
  );
  db.db.close();
});
test("bounded pending pagination and explicit evidence retrieval", () => {
  const db = setup();
  for (let i = 2; i < 28; i++)
    db.capture("alice", "s1", capture("c" + i, "text " + i));
  assert.equal(db.batch("alice", "s1").captures.length, 12);
  assert.equal(db.batch("alice", "s1").nextOffset, 12);
  assert.equal(db.batch("alice", "s1", 24).captures.length, 3);
  assert.equal(db.batch("alice", "s1", 0, ["c26"]).captures[0].id, "c26");
  db.db.close();
});
test("durability survives database reopen; deletion cannot be reversed by queued captures", () => {
  const path = "/tmp/rabbithole-test-" + crypto.randomUUID() + ".sqlite";
  const db = new Store(path);
  db.create("alice", { id: "s1", title: "Durable" });
  db.capture("alice", "s1", capture("c1"));
  db.db.close();
  const reopened = new Store(path);
  assert.equal(reopened.get("alice", "s1").captures.length, 1);
  reopened.delete("alice", "s1");
  assert.throws(
    () => reopened.capture("alice", "s1", capture("c1")),
    /not found/,
  );
  reopened.db.close();
});
