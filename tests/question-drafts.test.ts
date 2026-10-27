import { test } from "node:test";
import assert from "node:assert/strict";
import { AnalysisDrafts } from "../apps/server/src/analysis-drafts";
import { setup, analysis } from "./support";
test("question-only preflight inherits saved sources and preserves the entire saved guide", () => {
  const db = setup();
  try {
    db.save("alice", analysis());
    const before = db.get("alice", "s1"),
      drafts = new AnalysisDrafts(db);
    const q = {
      id: "new_question",
      type: "quiz",
      prompt: "Which workload can run in parallel?",
      answer: "Independent operations.",
      choices: ["Independent operations", "One operation waiting on another"],
      correctIndex: 0,
      conceptIds: ["n1"],
      level: "apply",
    };
    const checked = drafts.validateQuestions("alice", {
      sessionId: "s1",
      expectedVersion: 1,
      questions: [
        { ...q, captureIds: ["a malformed UUID must not be retyped here"] },
      ],
    });
    assert.equal(db.get("alice", "s1").version, 1);
    drafts.save("alice", checked.saveArguments);
    const after = db.get("alice", "s1");
    assert.deepEqual(after.analysis!.concepts, before.analysis!.concepts);
    assert.deepEqual(after.analysis!.edges, before.analysis!.edges);
    assert.deepEqual(
      after.analysis!.studyItems.slice(0, 3),
      before.analysis!.studyItems,
    );
    assert.deepEqual(after.analysis!.studyItems.at(-1)!.captureIds, ["c1"]);
    assert.deepEqual(after.processed, before.processed);
  } finally {
    db.db.close();
  }
});
test("question-only validation refuses stale, unknown concepts, overwritten IDs and hidden evidence", () => {
  const db = setup();
  try {
    db.save("alice", analysis());
    const drafts = new AnalysisDrafts(db),
      q = { ...analysis().studyItems[0], id: "new_question" };
    assert.throws(
      () =>
        drafts.validateQuestions("alice", {
          sessionId: "s1",
          expectedVersion: 0,
          questions: [q],
        }),
      /Stale version/,
    );
    assert.throws(
      () =>
        drafts.validateQuestions("alice", {
          sessionId: "s1",
          expectedVersion: 1,
          questions: [{ ...q, conceptIds: ["typo"] }],
        }),
      /typo.*n1|n1.*typo/,
    );
    assert.throws(
      () =>
        drafts.validateQuestions("alice", {
          sessionId: "s1",
          expectedVersion: 1,
          questions: [{ ...q, id: "q1", prompt: "Changed answer key" }],
        }),
      /new.*ID|existing.*ID/i,
    );
    db.updateCapture("alice", "s1", "c1", { hidden: true });
    assert.throws(
      () =>
        drafts.validateQuestions("alice", {
          sessionId: "s1",
          expectedVersion: 1,
          questions: [q],
        }),
      /visible.*source|source.*visible/i,
    );
    assert.equal(db.get("alice", "s1").version, 1);
  } finally {
    db.db.close();
  }
});
