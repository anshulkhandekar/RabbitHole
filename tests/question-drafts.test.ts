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

test("question top-ups validate visible sources while preserving hidden guide receipts", () => {
  const db = setup();
  try {
    const source = db.get("alice", "s1").captures[0];
    db.capture("alice", "s1", {
      ...source,
      id: "c2",
      text: "Another supporting source.",
    });
    const a = analysis();
    a.processedCaptureIds = ["c1", "c2"];
    a.concepts[0].captureIds = ["c1", "c2"];
    Object.assign(a, {
      overview: {
        rootConceptId: "n1",
        summary: "A supported guide",
        takeaways: ["Parallel work"],
        route: ["n2"],
      },
    });
    db.save("alice", a);
    const original = db.get("alice", "s1").analysis!;
    db.updateCapture("alice", "s1", "c1", { hidden: true });
    const drafts = new AnalysisDrafts(db);
    const checked = drafts.validateQuestions("alice", {
      sessionId: "s1",
      expectedVersion: 1,
      questions: [{ ...a.studyItems[0], id: "new", conceptIds: ["n1"] }],
    });
    drafts.save("alice", checked.saveArguments);
    const saved = db.get("alice", "s1");
    assert.deepEqual(
      { ...saved.analysis, studyItems: original.studyItems },
      original,
      "question top-ups change only the question list in the stored guide",
    );
    assert.deepEqual(saved.analysis!.concepts, original.concepts);
    assert.deepEqual(saved.analysis!.edges, original.edges);
    assert.deepEqual(
      saved.analysis!.studyItems.slice(0, 3),
      original.studyItems,
    );
    assert.deepEqual(saved.analysis!.studyItems.at(-1)!.captureIds, ["c2"]);
    db.updateCapture("alice", "s1", "c1", { hidden: false });
    assert.deepEqual(db.batch("alice", "s1").analysis!.concepts[0].captureIds, [
      "c1",
      "c2",
    ]);
  } finally {
    db.db.close();
  }
});
test("an idea whose only source was deleted produces an actionable question-target error", () => {
  const db = setup();
  try {
    db.save("alice", analysis());
    db.removeCapture("alice", "s1", "c1");
    assert.throws(
      () =>
        new AnalysisDrafts(db).validateQuestions("alice", {
          sessionId: "s1",
          expectedVersion: 1,
          questions: [
            { ...analysis().studyItems[0], id: "new", conceptIds: ["n1"] },
          ],
        }),
      (e: any) => {
        assert.equal(e.status, 422);
        assert.match(e.message, /GPU.*n1|n1.*GPU/);
        assert.match(e.message, /no visible.*sources.*rebuild/i);
        assert.doesNotMatch(e.message, /"code"|"path"|ZodError/);
        return true;
      },
    );
  } finally {
    db.db.close();
  }
});

test("question approval rechecks source visibility and malformed input returns actionable errors", () => {
  const db = setup();
  try {
    db.save("alice", analysis());
    const drafts = new AnalysisDrafts(db);
    assert.throws(
      () =>
        drafts.validateQuestions("alice", {
          sessionId: "s1",
          expectedVersion: 1,
          questions: [{ id: "bad" }],
        }),
      (e: any) => {
        assert.equal(e.status, 422);
        assert.match(e.message, /Invalid question payload.*questions\.0/);
        assert.doesNotMatch(e.message, /"code"|ZodError/);
        return true;
      },
    );
    const checked = drafts.validateQuestions("alice", {
      sessionId: "s1",
      expectedVersion: 1,
      questions: [{ ...analysis().studyItems[0], id: "new" }],
    });
    db.updateCapture("alice", "s1", "c1", { hidden: true });
    assert.throws(
      () => drafts.save("alice", checked.saveArguments),
      /supporting source.*hidden or deleted.*ValidateSessionQuestions/i,
    );
    assert.equal(db.get("alice", "s1").version, 1);
    assert.equal(db.get("alice", "s1").analysis!.studyItems.length, 3);
  } finally {
    db.db.close();
  }
});

for (const removal of ["hidden", "deleted"] as const)
  test(`question-only approval explains a source ${removal} after validation without mutation`, () => {
    const db = setup();
    try {
      db.save("alice", analysis());
      const drafts = new AnalysisDrafts(db),
        checked = drafts.validateQuestions("alice", {
          sessionId: "s1",
          expectedVersion: 1,
          questions: [{ ...analysis().studyItems[0], id: "new" }],
        });
      if (removal === "hidden")
        db.updateCapture("alice", "s1", "c1", { hidden: true });
      else db.removeCapture("alice", "s1", "c1");
      const before = db.get("alice", "s1");
      assert.throws(
        () => drafts.save("alice", checked.saveArguments),
        (e: any) => {
          assert.equal(e.status, 422);
          assert.match(
            e.message,
            /supporting source.*hidden or deleted after validation/i,
          );
          assert.match(
            e.message,
            /Re-run ValidateSessionQuestions.*current version.*nothing was saved/i,
          );
          assert.doesNotMatch(e.message, /edit|captureIds/);
          return true;
        },
      );
      assert.deepEqual(db.get("alice", "s1"), before);
    } finally {
      db.db.close();
    }
  });

for (const parent of ["hidden", "deleted", "unknown", "visible"] as const)
  test(`question top-up explains ${parent} variantOf parents without changing the guide`, () => {
    const db = setup();
    try {
      const source = db.get("alice", "s1").captures[0];
      db.capture("alice", "s1", {
        ...source,
        id: "c2",
        text: "Independent operations proceed together.",
      });
      const a = analysis();
      a.concepts[0].captureIds = ["c1", "c2"];
      a.processedCaptureIds = ["c1", "c2"];
      a.studyItems.push({
        ...a.studyItems[0],
        id: "q2v",
        conceptIds: ["n1"],
        captureIds: ["c2"],
      } as (typeof a.studyItems)[number]);
      db.save("alice", a);
      if (parent === "hidden")
        db.updateCapture("alice", "s1", "c2", { hidden: true });
      if (parent === "deleted") db.removeCapture("alice", "s1", "c2");
      const before = db.get("alice", "s1"),
        drafts = new AnalysisDrafts(db),
        request = {
          sessionId: "s1",
          expectedVersion: 1,
          questions: [
            {
              ...a.studyItems[0],
              id: "x5",
              conceptIds: ["n1"],
              variantOf: parent === "unknown" ? "missing-question" : "q2v",
            },
          ],
        };
      if (parent === "visible") {
        const checked = drafts.validateQuestions("alice", request);
        assert.deepEqual(db.get("alice", "s1"), before);
        drafts.save("alice", checked.saveArguments);
        assert.equal(
          db.get("alice", "s1").analysis!.studyItems.at(-1)!.variantOf,
          "q2v",
        );
      } else {
        assert.throws(
          () => drafts.validateQuestions("alice", request),
          (e: any) => {
            assert.equal(e.status, 422);
            assert.match(e.message, /Question x5/);
            if (parent === "unknown") {
              assert.match(
                e.message,
                /unknown.*missing-question|missing-question.*unknown/i,
              );
            } else {
              assert.match(
                e.message,
                /variant of q2v.*sources are hidden or deleted/i,
              );
              assert.match(
                e.message,
                /Unhide.*choose a visible question as variantOf.*nothing was saved/i,
              );
            }
            assert.doesNotMatch(e.message, /ZodError|"code"|"path"/);
            return true;
          },
        );
        assert.deepEqual(db.get("alice", "s1"), before);
      }
    } finally {
      db.db.close();
    }
  });

test("question top-ups can still reference another new question later in the same batch", () => {
  const db = setup();
  try {
    db.save("alice", analysis());
    const drafts = new AnalysisDrafts(db),
      q = analysis().studyItems[0];
    const checked = drafts.validateQuestions("alice", {
      sessionId: "s1",
      expectedVersion: 1,
      questions: [
        { ...q, id: "new-variant", variantOf: "new-original" },
        { ...q, id: "new-original" },
      ],
    });
    drafts.save("alice", checked.saveArguments);
    assert.equal(
      db
        .get("alice", "s1")
        .analysis!.studyItems.find((q) => q.id === "new-variant")!.variantOf,
      "new-original",
    );
  } finally {
    db.db.close();
  }
});
