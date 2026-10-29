import { test } from "node:test";
import assert from "node:assert/strict";
import { AnalysisDrafts } from "../apps/server/src/analysis-drafts";
import { setup, analysis } from "./support";

test("validated references cannot be used by another owner or change the reviewed title", () => {
  const db = setup();
  try {
    db.create("bob", { id: "bob-session", title: "Other owner's session" });
    const drafts = new AnalysisDrafts(db),
      receipt = drafts.validate("alice", analysis());
    assert.throws(
      () =>
        drafts.save("bob", {
          ...receipt.saveArguments,
          sessionId: "bob-session",
        }),
      /unavailable/,
    );
    assert.throws(
      () =>
        drafts.save("alice", {
          ...receipt.saveArguments,
          title: "Changed title",
        }),
      /title mismatch/,
    );
    assert.equal(db.get("alice", "s1").analysis, null);
    assert.equal(db.get("bob", "bob-session").analysis, null);
  } finally {
    db.db.close();
  }
});

test("validation never reserves a version: the approved save rejects a stale draft", () => {
  const db = setup();
  try {
    const drafts = new AnalysisDrafts(db),
      receipt = drafts.validate("alice", analysis());
    db.save("alice", { ...analysis(), title: "A newer saved guide" });
    assert.throws(
      () => drafts.save("alice", receipt.saveArguments),
      /Stale version/,
    );
    assert.equal(db.get("alice", "s1").analysis!.title, "A newer saved guide");
    assert.equal(db.get("alice", "s1").title, "Research");
    assert.equal(db.get("alice", "s1").version, 1);
  } finally {
    db.db.close();
  }
});

test("expired references and references lost on restart require fresh validation without saving", () => {
  const db = setup();
  try {
    let now = 0;
    const drafts = new AnalysisDrafts(db, () => now),
      receipt = drafts.validate("alice", analysis());
    assert.throws(
      () => new AnalysisDrafts(db).save("alice", receipt.saveArguments),
      /unavailable/,
    );
    now = 31 * 60_000;
    assert.throws(() => drafts.save("alice", receipt.saveArguments), /expired/);
    assert.equal(db.get("alice", "s1").version, 0);
    assert.equal(db.get("alice", "s1").processed.length, 0);
  } finally {
    db.db.close();
  }
});
