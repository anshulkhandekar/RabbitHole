import { test } from "node:test";
import assert from "node:assert/strict";
import { analysis, capture, setup } from "./support";
import { AnalysisDrafts } from "../apps/server/src/analysis-drafts";
import type { AnalysisData } from "../packages/contracts/src/index";

for (const wrongId of ["mistyped-session", "s2"])
  test(`a draft/session mismatch (${wrongId}) gives exact owned retry arguments without guessing or writing`, () => {
    const db = setup();
    try {
      db.create("alice", { id: "s2", title: "Another rabbit hole" });
      const drafts = new AnalysisDrafts(db),
        receipt = drafts.validate("alice", analysis());
      const before = db.get("alice", "s1");
      let retry: any;
      assert.throws(
        () =>
          drafts.save("alice", {
            ...receipt.saveArguments,
            sessionId: wrongId,
          }),
        (e: any) => {
          assert.equal(e.status, 422);
          assert.match(e.message, /session.*mismatch/i);
          assert.match(e.message, /nothing was saved/i);
          assert.match(e.message, /saveArguments: /);
          retry = JSON.parse(e.message.split("saveArguments: ")[1]);
          assert.deepEqual(retry, receipt.saveArguments);
          return true;
        },
      );
      assert.deepEqual(db.get("alice", "s1"), before);
      assert.equal(db.get("alice", "s2").version, 0);
      assert.equal(drafts.save("alice", retry).version, 1);
    } finally {
      db.db.close();
    }
  });

test("foreign and expired drafts never disclose correctable approval arguments", () => {
  const db = setup();
  try {
    let now = 0;
    const drafts = new AnalysisDrafts(db, () => now),
      receipt = drafts.validate("alice", analysis());
    for (const owner of ["bob", "alice"]) {
      if (owner === "alice") now = 31 * 60000;
      assert.throws(
        () =>
          drafts.save(owner, { ...receipt.saveArguments, sessionId: "wrong" }),
        (e: any) => {
          assert.equal(e.status, 404);
          assert.match(e.message, /unavailable or expired/);
          assert.doesNotMatch(
            e.message,
            /saveArguments:|How parallel computing/,
          );
          return true;
        },
      );
    }
    assert.equal(db.get("alice", "s1").version, 0);
  } finally {
    db.db.close();
  }
});

test("Go saves preserve named session titles, including a rename after preflight", () => {
  const db = setup();
  try {
    const drafts = new AnalysisDrafts(db),
      receipt = drafts.validate("alice", analysis());
    db.patch("alice", "s1", { title: "My chosen research question" });
    drafts.save("alice", receipt.saveArguments);
    assert.equal(db.get("alice", "s1").title, "My chosen research question");
    assert.equal(
      db.get("alice", "s1").analysis!.title,
      "How parallel computing fits together",
    );
    db.capture("alice", "s1", capture("c2", "Later source"));
    db.save("alice", {
      ...analysis(),
      expectedVersion: 1,
      title: "Go suggests a different title",
      processedCaptureIds: ["c2"],
    });
    assert.equal(db.get("alice", "s1").title, "My chosen research question");
  } finally {
    db.db.close();
  }
});

function supportedGuide(): AnalysisData {
  const a: AnalysisData = analysis();
  a.processedCaptureIds = ["c1", "c2"];
  a.studyItems[0].captureIds = ["c1", "c2"];
  a.studyItems[0].evidence = [
    { captureId: "c1", quote: "A GPU uses parallel execution" },
    { captureId: "c2", quote: "Independent operations proceed together" },
  ];
  return a;
}
test("unchanged questions retain their visible sources and exact quotes across validated incremental saves", () => {
  const db = setup();
  try {
    db.capture(
      "alice",
      "s1",
      capture("c2", "Independent operations proceed together."),
    );
    db.save("alice", supportedGuide());
    db.capture("alice", "s1", capture("c3", "New material"));
    const next = supportedGuide();
    next.expectedVersion = 1;
    next.processedCaptureIds = ["c3"];
    next.studyItems[0].captureIds = ["c2"];
    next.studyItems[0].evidence = undefined;
    const drafts = new AnalysisDrafts(db),
      receipt = drafts.validate("alice", next);
    assert.equal(db.get("alice", "s1").version, 1);
    drafts.save("alice", receipt.saveArguments);
    const q = db.get("alice", "s1").analysis!.studyItems[0];
    assert.deepEqual(q.captureIds, ["c1", "c2"]);
    assert.deepEqual(q.evidence, [
      { captureId: "c1", quote: "A GPU uses parallel execution" },
      { captureId: "c2", quote: "Independent operations proceed together" },
    ]);
  } finally {
    db.db.close();
  }
});

test("an explicit rebuild can intentionally replace question evidence", () => {
  const db = setup();
  try {
    db.capture(
      "alice",
      "s1",
      capture("c2", "Independent operations proceed together."),
    );
    db.save("alice", supportedGuide());
    const next = supportedGuide();
    next.expectedVersion = 1;
    next.intent = "rebuild";
    next.processedCaptureIds = [];
    next.studyItems[0].captureIds = ["c2"];
    next.studyItems[0].evidence = [
      { captureId: "c2", quote: "Independent operations proceed together" },
    ];
    db.save("alice", next);
    assert.deepEqual(db.get("alice", "s1").analysis!.studyItems[0].captureIds, [
      "c2",
    ]);
    assert.equal(
      db.get("alice", "s1").analysis!.studyItems[0].evidence!.length,
      1,
    );
  } finally {
    db.db.close();
  }
});

test("an unnamed session adopts its first guide title only once", () => {
  const db = setup();
  try {
    db.patch("alice", "s1", { title: "New rabbit hole" });
    db.save("alice", analysis());
    assert.equal(
      db.get("alice", "s1").title,
      "How parallel computing fits together",
    );
    db.capture("alice", "s1", capture("c2", "New source"));
    db.save("alice", {
      ...analysis(),
      expectedVersion: 1,
      title: "A later guide title",
      processedCaptureIds: ["c2"],
    });
    assert.equal(
      db.get("alice", "s1").title,
      "How parallel computing fits together",
    );
  } finally {
    db.db.close();
  }
});

for (const removal of ["hidden", "deleted"] as const)
  test(`citation preservation never brings back ${removal} evidence`, () => {
    const db = setup();
    try {
      db.capture(
        "alice",
        "s1",
        capture("c2", "Independent operations proceed together."),
      );
      db.save("alice", supportedGuide());
      if (removal === "hidden")
        db.updateCapture("alice", "s1", "c1", { hidden: true });
      else db.removeCapture("alice", "s1", "c1");
      db.capture("alice", "s1", capture("c3", "New material"));
      const next = supportedGuide();
      next.expectedVersion = 1;
      next.processedCaptureIds = ["c3"];
      for (const item of [
        ...next.concepts,
        ...next.edges,
        ...next.studyItems,
      ]) {
        item.captureIds = ["c2"];
        item.evidence = undefined;
      }
      db.save("alice", next);
      const saved = db.get("alice", "s1").analysis!;
      for (const item of [
        ...saved.concepts,
        ...saved.edges,
        ...saved.studyItems,
      ]) {
        assert.ok(!item.captureIds.includes("c1"));
        assert.ok(!item.evidence?.some((e) => e.captureId === "c1"));
      }
      assert.deepEqual(saved.studyItems[0].evidence, [
        { captureId: "c2", quote: "Independent operations proceed together" },
      ]);
    } finally {
      db.db.close();
    }
  });

test("changed questions do not inherit old quotations and invalid incoming quotes still fail atomically", () => {
  const db = setup();
  try {
    db.capture(
      "alice",
      "s1",
      capture("c2", "Independent operations proceed together."),
    );
    db.save("alice", supportedGuide());
    db.capture("alice", "s1", capture("c3", "New material"));
    const next = supportedGuide();
    next.expectedVersion = 1;
    next.processedCaptureIds = ["c3"];
    next.studyItems[0].evidence = [
      { captureId: "c2", quote: "A fabricated quote" },
    ];
    const before = db.get("alice", "s1");
    assert.throws(() => db.save("alice", next), /exact source quotations/);
    assert.deepEqual(db.get("alice", "s1"), before);
    next.studyItems[0].prompt = "A deliberately different question";
    next.studyItems[0].captureIds = ["c2"];
    next.studyItems[0].evidence = undefined;
    db.save("alice", next);
    const q = db.get("alice", "s1").analysis!.studyItems[0];
    assert.deepEqual(q.captureIds, ["c2"]);
    assert.equal(q.evidence, undefined);
  } finally {
    db.db.close();
  }
});

test("preserving quotations cannot exceed citation limits or silently discard saved evidence", () => {
  const db = setup();
  try {
    db.capture(
      "alice",
      "s1",
      capture("c2", "Independent operations proceed together."),
    );
    const a = supportedGuide();
    a.studyItems[0].evidence!.push({
      captureId: "c1",
      quote: "many operations at once",
    });
    db.save("alice", a);
    db.capture("alice", "s1", capture("c3", "New material"));
    const next = structuredClone(a);
    next.expectedVersion = 1;
    next.processedCaptureIds = ["c3"];
    next.studyItems[0].evidence = [
      { captureId: "c1", quote: "process many operations" },
    ];
    const before = db.get("alice", "s1");
    assert.throws(
      () => db.save("alice", next),
      /q1.*citation limits.*explicitly rebuild/i,
    );
    assert.deepEqual(db.get("alice", "s1"), before);
  } finally {
    db.db.close();
  }
});

test("adding hints to an otherwise unchanged question does not silently narrow its supporting evidence", () => {
  const db = setup();
  try {
    db.capture(
      "alice",
      "s1",
      capture("c2", "Independent operations proceed together."),
    );
    db.save("alice", supportedGuide());
    db.capture("alice", "s1", capture("c3", "New material"));
    const next = supportedGuide();
    next.expectedVersion = 1;
    next.processedCaptureIds = ["c3"];
    next.studyItems[0].captureIds = ["c2"];
    next.studyItems[0].evidence = undefined;
    next.studyItems[0].hints = [
      "Think about operations that do not wait for one another.",
    ];
    db.save("alice", next);
    const q = db.get("alice", "s1").analysis!.studyItems[0];
    assert.deepEqual(q.captureIds, ["c1", "c2"]);
    assert.equal(q.evidence!.length, 2);
    assert.equal(q.hints!.length, 1);
  } finally {
    db.db.close();
  }
});
