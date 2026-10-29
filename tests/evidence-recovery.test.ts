import { test } from "node:test";
import assert from "node:assert/strict";
import { setup, analysis, capture } from "./support";
import { AnalysisDrafts } from "../apps/server/src/analysis-drafts";

test("failed quote validation returns exact passages that repair a complete 14-source draft without saving it", () => {
  const db = setup();
  try {
    for (let i = 2; i <= 14; i++)
      db.capture(
        "alice",
        "s1",
        capture(`c${i}`, `Source ${i} describes a distinct research topic.`),
      );
    const drafts = new AnalysisDrafts(db),
      payload: any = analysis();
    payload.processedCaptureIds = Array.from(
      { length: 14 },
      (_, i) => `c${i + 1}`,
    );
    payload.concepts[0].evidence = [
      { captureId: "c1", quote: "GPUs execute many operations in parallel." },
    ];
    payload.studyItems[0].evidence = [
      { captureId: "c1", quote: "A GPU processes everything simultaneously." },
    ];
    const before = db.get("alice", "s1");
    let failure: any;
    assert.throws(
      () => drafts.validate("alice", payload),
      (error: any) => {
        failure = error;
        assert.equal(error.status, 422);
        assert.match(error.message, /exact source quotations/);
        return true;
      },
    );
    assert.deepEqual(db.get("alice", "s1"), before);
    assert.equal(failure.details?.evidenceRepairs.length, 2);
    for (const repair of failure.details.evidenceRepairs) {
      assert.equal(repair.captureId, "c1");
      assert.ok(repair.candidates.length);
      for (const quote of repair.candidates) {
        assert.ok(before.captures[0].text.includes(quote));
        assert.ok(quote.length <= 500);
      }
      if (repair.path.startsWith("concepts"))
        payload.concepts[0].evidence[0].quote = repair.candidates[0];
      else payload.studyItems[0].evidence[0].quote = repair.candidates[0];
    }
    const receipt = drafts.validate("alice", payload);
    assert.equal(db.get("alice", "s1").version, 0);
    drafts.save("alice", receipt.saveArguments);
    const saved = db.get("alice", "s1");
    assert.equal(saved.version, 1);
    assert.equal(saved.processed.length, 14);
    assert.equal(saved.analysis!.studyItems.length, payload.studyItems.length);
  } finally {
    db.db.close();
  }
});

test("quote repairs choose relevant exact text beyond a long introduction and expose no hidden sources", () => {
  const db = setup();
  try {
    const relevant =
      "Aurora storage replicates database pages across availability zones.";
    db.capture(
      "alice",
      "s1",
      capture(
        "long",
        "Follow the author for more articles. ".repeat(100) + relevant,
      ),
    );
    const p: any = analysis();
    p.processedCaptureIds.push("long");
    p.concepts[0].captureIds = ["long"];
    p.concepts[0].evidence = [
      {
        captureId: "long",
        quote: "Aurora replicates its storage across many availability zones.",
      },
    ];
    assert.throws(
      () => db.validate("alice", p),
      (e: any) => {
        assert.equal(e.details?.evidenceRepairs[0].candidates[0], relevant);
        return true;
      },
    );
    db.updateCapture("alice", "s1", "long", { hidden: true });
    assert.throws(
      () => db.validate("alice", p),
      (e: any) => {
        assert.equal(e.details, undefined);
        assert.doesNotMatch(e.message, /Aurora storage/);
        return true;
      },
    );
    assert.throws(() => db.validate("bob", p), /Session not found/);
  } finally {
    db.db.close();
  }
});
