import { test } from "node:test";
import assert from "node:assert/strict";
import { Preferences, Study } from "../packages/contracts/src/index";
import { setup, analysis } from "./support";

// A rebuild must be explicit; permitting an ordinary no-new-content save is a bug.
test("explicit rebuild can enrich existing evidence without new captures and remains version protected", () => {
  const db = setup();
  db.save("alice", analysis());
  const rich = {
    ...analysis(),
    expectedVersion: 1,
    intent: "rebuild",
    processedCaptureIds: [],
    overview: {
      rootConceptId: "n1",
      summary: "The trail links the GPU to parallel execution.",
      takeaways: ["Independent operations can run at once."],
      route: ["n1", "n2"],
    },
  };
  const result = db.save("alice", rich);
  assert.equal(result.version, 2);
  assert.equal(db.get("alice", "s1").captures.length, 1);
  assert.equal(
    (db.get("alice", "s1").analysis as any).overview.rootConceptId,
    "n1",
  );
  assert.throws(() => db.save("alice", rich), /Stale/);
  db.db.close();
});
test("invented evidence excerpts and cyclic hierarchy cannot be saved", () => {
  const db = setup();
  const rich: any = analysis();
  rich.concepts[0].evidence = [
    { captureId: "c1", quote: "Invented words not present in the source" },
  ];
  assert.throws(() => db.save("alice", rich), /excerpt|quotation/i);
  delete rich.concepts[0].evidence;
  rich.concepts[0].parentId = "n2";
  rich.concepts[1].parentId = "n1";
  assert.throws(() => db.save("alice", rich), /hierarchy|cycle/i);
  assert.equal(db.get("alice", "s1").version, 0);
  db.db.close();
});
test("matching has unambiguous pairs and rejects incomplete or forged review grading", () => {
  const item = {
    id: "m1",
    type: "matching",
    prompt: "Match ideas to their explanations",
    answer: "The processor uses parallel execution.",
    pairs: [
      { left: "GPU", right: "Processor" },
      { left: "Parallel execution", right: "Concurrent operations" },
    ],
    conceptIds: ["n1", "n2"],
    captureIds: ["c1"],
  };
  assert.equal(Study.safeParse(item).success, true);
  assert.equal(
    Study.safeParse({
      ...item,
      pairs: [
        { left: "Same", right: "A" },
        { left: "Same", right: "B" },
      ],
    }).success,
    false,
  );
  const db = setup(),
    a: any = analysis();
  a.studyItems.push(item);
  db.save("alice", a);
  const review = {
    id: "match1",
    studyId: "m1",
    analysisVersion: 1,
    rating: "understood",
    matches: [1, 0],
    timestamp: new Date().toISOString(),
  };
  assert.throws(() => db.review("alice", "s1", review), /rating|grade/i);
  const result = db.review("alice", "s1", { ...review, rating: "again" });
  assert.equal(result.correct, false);
  assert.deepEqual((db.get("alice", "s1").attempts[0] as any).matches, [1, 0]);
  assert.throws(
    () =>
      db.review("alice", "s1", {
        ...review,
        id: "bad",
        matches: [0],
        rating: "again",
      }),
    /matching|matches/i,
  );
  db.db.close();
});
test("new sessions collect trusted highlights by default and preserve an explicit opt-out", () => {
  assert.equal(Preferences.parse({}).autoHighlights, true);
  assert.equal(
    Preferences.parse({ autoHighlights: false }).autoHighlights,
    false,
  );
  assert.equal(
    Preferences.safeParse({
      autoHighlights: true,
      activities: ["quiz", "matching"],
    }).success,
    true,
  );
});

test("quiz reviews with a selected choice cannot persist a contradictory grade", () => {
  const db = setup();
  db.save("alice", analysis());
  const attempt = {
    id: "quiz-grade",
    studyId: "q1",
    analysisVersion: 1,
    rating: "understood",
    choice: 0,
    timestamp: new Date().toISOString(),
  };
  assert.throws(() => db.review("alice", "s1", attempt), /grade|rating/i);
  assert.equal(
    db.review("alice", "s1", { ...attempt, choice: 1 }).correct,
    true,
  );
  db.db.close();
});

// A generic quote error forces the agent to guess or discard valid content.
test("quote validation identifies every invalid evidence path and preserves the saved guide for a targeted retry", () => {
  const db = setup();
  try {
    db.save("alice", analysis());
    const before = db.get("alice", "s1");
    const rich: any = {
      ...analysis(),
      expectedVersion: 1,
      intent: "rebuild",
      processedCaptureIds: [],
    };
    rich.concepts[0].evidence = [
      { captureId: "c1", quote: "Invented concept quote" },
    ];
    rich.edges[0].evidence = [
      { captureId: "c1", quote: "Invented edge quote" },
    ];
    assert.throws(
      () => db.save("alice", rich),
      (error: any) => {
        assert.match(error.message, /concepts\[0\]\.evidence\[0\].*n1.*c1/);
        assert.match(error.message, /edges\[0\]\.evidence\[0\].*e1.*c1/);
        assert.doesNotMatch(
          error.message,
          /Invented concept quote|Invented edge quote/,
        );
        return true;
      },
    );
    assert.deepEqual(db.get("alice", "s1"), before);
    rich.concepts[0].evidence[0].quote = "A GPU uses parallel execution";
    rich.edges[0].evidence[0].quote = "many operations at once.";
    assert.equal(db.save("alice", rich).version, 2);
    assert.equal(db.get("alice", "s1").analysis!.edges.length, 1);
    assert.equal(db.get("alice", "s1").analysis!.studyItems.length, 3);
  } finally {
    db.db.close();
  }
});
