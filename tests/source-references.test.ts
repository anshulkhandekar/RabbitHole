import { test } from "node:test";
import assert from "node:assert/strict";
import { AnalysisDrafts } from "../apps/server/src/analysis-drafts";
import { setup, analysis, capture } from "./support";

test("GetSession short references round-trip through validated save as exact canonical source IDs", () => {
  const db = setup();
  try {
    const first = db.batch("alice", "s1"),
      ref = (first.captures[0] as any).ref;
    assert.match(ref, /^src_[a-f0-9]{16}$/);
    assert.deepEqual((first as any).processingDefaults.processedCaptureIds, [
      ref,
    ]);
    const a = analysis();
    a.processedCaptureIds = [ref];
    for (const item of [...a.concepts, ...a.edges, ...a.studyItems])
      item.captureIds = [ref];
    Object.assign(a.concepts[0], {
      evidence: [{ captureId: ref, quote: "A GPU uses parallel execution" }],
    });
    const drafts = new AnalysisDrafts(db),
      receipt = drafts.validate("alice", a);
    assert.equal(db.get("alice", "s1").version, 0);
    drafts.save("alice", receipt.saveArguments);
    const saved = db.get("alice", "s1");
    assert.deepEqual(saved.processed, ["c1"]);
    assert.deepEqual(saved.analysis!.concepts[0].captureIds, ["c1"]);
    assert.equal(saved.analysis!.concepts[0].evidence![0].captureId, "c1");
    assert.equal(
      (db.batch("alice", "s1", 0, [ref]).captures[0] as any).ref,
      ref,
    );
  } finally {
    db.db.close();
  }
});
test("short references stay stable across paging/deletion and cannot bypass hidden-source guards", () => {
  const db = setup();
  try {
    db.capture("alice", "s1", capture("c2", "A second inspected source."));
    const all = db.batch("alice", "s1"),
      ref = (all.captures[1] as any).ref;
    assert.ok(ref);
    db.removeCapture("alice", "s1", "c1");
    assert.equal((db.batch("alice", "s1").captures[0] as any).ref, ref);
    db.updateCapture("alice", "s1", "c2", { hidden: true });
    const a = analysis();
    a.processedCaptureIds = [ref];
    for (const item of [...a.concepts, ...a.edges, ...a.studyItems])
      item.captureIds = [ref];
    assert.throws(
      () => new AnalysisDrafts(db).validate("alice", a),
      /hid or deleted/,
    );
  } finally {
    db.db.close();
  }
});
test("a capture typo identifies its field and supplies exact references without guessing or saving", () => {
  const db = setup();
  try {
    const a = analysis();
    a.concepts[0].captureIds = ["typo-capture"];
    assert.throws(
      () => db.validate("alice", a),
      (e) => {
        assert.match((e as Error).message, /concepts\[0\]\.captureIds\[0\]/);
        assert.match((e as Error).message, /typo-capture/);
        assert.match((e as Error).message, /src_/);
        return true;
      },
    );
    assert.equal(db.get("alice", "s1").version, 0);
  } finally {
    db.db.close();
  }
});
test("empty incremental processing explains pending IDs instead of falsely claiming no new captures", () => {
  const db = setup();
  try {
    const a = analysis();
    a.processedCaptureIds = [];
    a.concepts[0].captureIds = ["c1"];
    assert.throws(
      () => db.validate("alice", a),
      /processedCaptureIds.*pending|pending.*processedCaptureIds/,
    );
  } finally {
    db.db.close();
  }
});
test("search-only trails can save an honest interest-and-gap map without fabricated factual activities", () => {
  const db = setup();
  try {
    db.removeCapture("alice", "s1", "c1");
    db.capture("alice", "s1", {
      ...capture("search1", "rds private subnet"),
      sourceType: "search",
    });
    const batch = db.batch("alice", "s1"),
      ref = (batch.captures[0] as any).ref;
    assert.ok(ref);
    const a = {
      ...analysis(),
      concepts: [
        {
          id: "interest",
          main: true,
          label: "RDS networking",
          explanation: "Your search asks about RDS in a private subnet.",
          gap: "No article or highlight has been captured to establish how this works.",
          captureIds: [ref],
        },
      ],
      edges: [],
      studyItems: [],
      processedCaptureIds: [ref],
    };
    const drafts = new AnalysisDrafts(db),
      checked = drafts.validate("alice", a);
    drafts.save("alice", checked.saveArguments);
    assert.equal(db.get("alice", "s1").version, 1);
    assert.equal(db.batch("alice", "s1").pending, 0);
  } finally {
    db.db.close();
  }
});
