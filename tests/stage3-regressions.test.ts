// Regression coverage for source removal, exports, and offline capture recovery.
import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, analysis, capture } from "./support";
import { toAnkiCsv, toMarkdown } from "../apps/extension/src/export-model";
import { worker } from "./worker-harness";

const quote = "process many operations at once";
for (const action of ["hide", "delete"] as const) {
  test(`GetSession must withhold saved evidence quotes after ${action}`, () => {
    const db = setup();
    try {
      const a = analysis();
      Object.assign(a.concepts[1], { evidence: [{ captureId: "c1", quote }] });
      db.save("alice", a);
      if (action === "hide")
        db.updateCapture("alice", "s1", "c1", { hidden: true });
      else db.removeCapture("alice", "s1", "c1");
      const batch = db.batch("alice", "s1");
      assert.equal(batch.captures.length, 0);
      assert.equal(JSON.stringify(batch.analysis).includes(quote), false);
      assert.deepEqual(batch.analysis!.processedCaptureIds, []);
      assert.deepEqual(batch.analysis!.concepts[1].captureIds, []);
      if (action === "hide") {
        // Hiding is undoable, so retain its saved receipts until explicitly deleted.
        assert.ok(
          JSON.stringify(db.get("alice", "s1").analysis).includes(quote),
        );
        db.updateCapture("alice", "s1", "c1", { hidden: false });
        assert.ok(
          JSON.stringify(db.batch("alice", "s1").analysis).includes(quote),
        );
      }
    } finally {
      db.db.close();
    }
  });
}

test("deletion erases saved receipts without erasing receipts for other hidden sources", () => {
  const db = setup();
  try {
    db.capture(
      "alice",
      "s1",
      capture("c2", "Separate evidence stays recoverable."),
    );
    const a = analysis();
    a.processedCaptureIds.push("c2");
    Object.assign(a.concepts[1], {
      captureIds: ["c1", "c2"],
      evidence: [
        { captureId: "c1", quote },
        { captureId: "c2", quote: "Separate evidence" },
      ],
    });
    db.save("alice", a);
    db.updateCapture("alice", "s1", "c2", { hidden: true });
    db.removeCapture("alice", "s1", "c1");
    const stored = db.get("alice", "s1");
    assert.equal(JSON.stringify(stored.analysis).includes(quote), false);
    assert.ok(JSON.stringify(stored.analysis).includes("Separate evidence"));
    db.updateCapture("alice", "s1", "c2", { hidden: false });
    assert.ok(
      JSON.stringify(db.batch("alice", "s1").analysis).includes(
        "Separate evidence",
      ),
    );
  } finally {
    db.db.close();
  }
});

test("exports choose a visible source when the first receipt is hidden", () => {
  const db = setup();
  try {
    db.capture("alice", "s1", {
      ...capture("c2", "A replacement source explains batches."),
      url: "https://visible.example/batches",
    });
    const a = analysis();
    a.processedCaptureIds.push("c2");
    Object.assign(a.studyItems[0], {
      captureIds: ["c1", "c2"],
      evidence: [
        { captureId: "c1", quote },
        { captureId: "c2", quote: "explains batches" },
      ],
    });
    db.save("alice", a);
    db.updateCapture("alice", "s1", "c1", { hidden: true });
    const csv = toAnkiCsv(db.get("alice", "s1"));
    assert.ok(csv.includes("https://visible.example/batches"));
    assert.ok(csv.includes("explains batches"));
    assert.equal(csv.includes("https://example.org/gpu"), false);
  } finally {
    db.db.close();
  }
});

test("deleting an absent capture leaves an idempotent tombstone before a delayed POST", () => {
  const db = setup();
  try {
    assert.doesNotThrow(() => db.removeCapture("alice", "s1", "late"));
    assert.doesNotThrow(() => db.removeCapture("alice", "s1", "late"));
    db.capture("alice", "s1", capture("late", "A delayed offline delivery"));
    assert.equal(
      db.get("alice", "s1").captures.some((c) => c.id === "late"),
      false,
    );
    assert.deepEqual(db.get("alice", "s1").removed, ["late"]);
  } finally {
    db.db.close();
  }
});

test("retagging a find does not create a second capture on automatic scans or retries", async () => {
  const url = "https://www.google.com/search?q=tides";
  const app = worker({ id: 7, url });
  const { active } = await app.request("start", { title: "Tides" });
  const c = {
    ...capture("first", "tides"),
    sessionId: active,
    url,
    sourceType: "search",
  };
  assert.equal(
    (await app.fromTab({ type: "capture", capture: c }, url, 7)).saved,
    true,
  );
  await app.request("capture-tag", {
    id: active,
    captureId: "first",
    tag: "confusing",
  });
  await app.fromTab({ type: "capture", capture: { ...c, id: "scan" } }, url, 7);
  assert.equal(app.local.state.sessions[active].captures.length, 1);
  const db = setup();
  try {
    db.updateCapture("alice", "s1", "c1", { tag: "confusing" });
    assert.doesNotThrow(() => db.capture("alice", "s1", capture()));
    assert.equal(db.get("alice", "s1").captures.length, 1);
    assert.equal(db.get("alice", "s1").captures[0].tag, "confusing");
  } finally {
    db.db.close();
  }
});

test("deleting an automatic source suppresses rescans but allows different content", async () => {
  const url = "https://www.google.com/search?q=tides";
  const app = worker({ id: 7, url });
  const { active } = await app.request("start", { title: "Tides" });
  const c = {
    ...capture("first", "tides"),
    sessionId: active,
    url,
    sourceType: "search",
  };
  assert.equal(
    (await app.fromTab({ type: "capture", capture: c }, url, 7)).saved,
    true,
  );
  await app.request("capture-delete", { id: active, captureId: "first" });
  await app.fromTab({ type: "capture", capture: { ...c, id: "scan" } }, url, 7);
  assert.equal(app.local.state.sessions[active].captures.length, 0);
  assert.ok(
    app.local.state.queue.some(
      (q: any) => q.method === "DELETE" && q.path.endsWith("/captures/first"),
    ),
  );
  const changed = await app.fromTab(
    { type: "capture", capture: { ...c, id: "changed", text: "spring tides" } },
    url,
    7,
  );
  assert.equal(changed.saved, true);
});

test("deleting c1 preserves queued changes for c10", async () => {
  const app = worker({ id: 7, url: "https://research.example/a" });
  const { active } = await app.request("start", { title: "Sources" });
  app.local.state.sessions[active].captures = [capture("c1"), capture("c10")];
  await app.request("capture-tag", {
    id: active,
    captureId: "c10",
    tag: "confusing",
  });
  const state = await app.request("capture-delete", {
    id: active,
    captureId: "c1",
  });
  assert.ok(
    state.queue.some(
      (q: any) => q.method === "PATCH" && q.path.endsWith("/captures/c10"),
    ),
  );
});

for (const format of ["Markdown", "Anki"] as const)
  test(`${format} must omit hidden evidence`, () => {
    const db = setup();
    try {
      const a = analysis();
      const evidence = [{ captureId: "c1", quote }];
      Object.assign(a.concepts[1], { evidence });
      Object.assign(a.studyItems[0], { evidence });
      db.save("alice", a);
      db.updateCapture("alice", "s1", "c1", { hidden: true });
      const s = db.get("alice", "s1");
      assert.equal(
        (format === "Markdown" ? toMarkdown(s) : toAnkiCsv(s)).includes(quote),
        false,
        `${format} leaks hidden quote`,
      );
    } finally {
      db.db.close();
    }
  });

test("a rebuild remains possible after deleting all old sources and adding a replacement", () => {
  const db = setup();
  try {
    db.save("alice", analysis());
    db.removeCapture("alice", "s1", "c1");
    db.capture("alice", "s1", capture("c2"));
    const a = analysis();
    const replacement = {
      ...a,
      expectedVersion: 1,
      intent: "rebuild",
      processedCaptureIds: ["c2"],
      concepts: a.concepts.map((c) => ({ ...c, captureIds: ["c2"] })),
      edges: a.edges.map((e) => ({ ...e, captureIds: ["c2"] })),
      studyItems: a.studyItems.map((i) => ({ ...i, captureIds: ["c2"] })),
    };
    assert.doesNotThrow(() => db.validate("alice", replacement));
  } finally {
    db.db.close();
  }
});
