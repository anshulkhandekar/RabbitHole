import { test } from "node:test";
import assert from "node:assert/strict";
import * as p from "../apps/extension/src/practice-model";
import { analysis } from "./support";
import type { AnalysisData, Attempt } from "../packages/contracts/src/index";
const bank = (): AnalysisData => ({
  ...analysis(),
  concepts: [
    { ...analysis().concepts[0], main: true },
    { ...analysis().concepts[1], parentId: "n1" },
    { ...analysis().concepts[0], id: "empty", main: true },
  ],
  studyItems: [
    { ...analysis().studyItems[0], conceptIds: ["n2"] },
    {
      ...analysis().studyItems[0],
      id: "variant",
      variantOf: "q1",
      conceptIds: ["n2"],
    },
    {
      ...analysis().studyItems[2],
      id: "hard",
      level: "apply",
      conceptIds: ["n2"],
    },
  ],
});
const attempt = (
  studyId: string,
  rating: Attempt["rating"] = "understood",
  extra: Partial<Attempt> = {},
): Attempt => ({
  id: studyId,
  studyId,
  rating,
  response: "",
  analysisVersion: 1,
  timestamp: new Date().toISOString(),
  ...extra,
});
test("topics follow ancestors, deduplicate cross-topic questions and report missing coverage", () => {
  const a = bank();
  a.studyItems[0].conceptIds = ["n1", "n2"];
  const hub = p.practiceHub(a, []);
  assert.equal(hub.topics[0].total, 3);
  assert.equal(hub.all.total, 3);
  assert.deepEqual(
    hub.coverage.emptyTopics.map((t) => t.id),
    ["empty"],
  );
  assert.equal(hub.topics[0].counts.quiz, 2);
  assert.equal(hub.all.untested, 3);
  assert.equal(
    p.practiceHub({ ...a, concepts: analysis().concepts }, []).topics.length,
    2,
  );
});
test("new questions start basic, review uses a sibling and confident misses lead", () => {
  const hub = p.practiceHub(bank(), [
    attempt("q1", "again", { confidence: "sure" }),
  ]);
  assert.equal(hub.topics[0].confidentMisses, 1);
  assert.equal(hub.topics[0].lanes.review[0].id, "variant");
  assert.equal(hub.topics[0].lanes.new[0].id, "hard");
  assert.equal(hub.topics[0].lanes.harder[0].id, "hard");
  assert.equal(
    hub.topics[0].strong +
      hub.topics[0].shaky +
      hub.topics[0].confidentMisses +
      hub.topics[0].untested,
    3,
  );
});
test("harder unlock needs every basic tried and 75 percent unaided with no confident misses", () => {
  const a = bank();
  assert.equal(p.harderReady(p.practiceHub(a, []).topics[0]).ready, false);
  const tried = [
    attempt("q1"),
    attempt("variant", "understood", { hintsUsed: 1 }),
  ];
  const locked = p.harderReady(p.practiceHub(a, tried).topics[0]);
  assert.equal(locked.ready, true);
  assert.equal(locked.reason.rightWithoutHints, 1);
  assert.equal(locked.reason.basicTotal, 1);
  assert.equal(
    p.harderReady(
      p.practiceHub(a, [attempt("q1"), attempt("variant")]).topics[0],
    ).ready,
    true,
  );
  assert.equal(p.harderReady(p.practiceHub(a, []).topics[1]).ready, false);
});
test("cycles and missing parents do not hang topic mapping; exhausted lanes never repeat items", () => {
  const a = bank();
  a.concepts[1].parentId = "n2";
  const hub = p.practiceHub(
    a,
    a.studyItems.map((i) => attempt(i.id)),
  );
  assert.equal(hub.all.lanes.new.length, 0);
  assert.equal(hub.all.lanes.harder.length, 0);
  assert.equal(hub.all.exhausted.new, true);
});
test("a correct sibling clears its family's confident miss and review obligation", () => {
  const a = bank();
  const hub = p.practiceHub(a, [
    attempt("q1", "again", {
      confidence: "sure",
      timestamp: "2026-10-27T10:00:00Z",
    }),
    attempt("variant", "understood", { timestamp: "2026-10-27T10:01:00Z" }),
  ]);
  assert.equal(hub.topics[0].confidentMisses, 0);
  assert.equal(hub.topics[0].lanes.review.length, 0);
});
test("a cross-topic question belongs only to its primary concept topic", () => {
  const a = bank();
  a.studyItems = [
    { ...a.studyItems[0], concept: "n1", conceptIds: ["n1", "empty"] },
  ];
  assert.deepEqual(
    p.practiceHub(a, []).topics.map((t) => t.total),
    [1, 0],
  );
});
test("mixed rounds interleave activities without repeats and retain basic-first order", () => {
  const a = bank();
  a.studyItems = [
    ...a.studyItems,
    { ...a.studyItems[0], id: "q2" },
    { ...analysis().studyItems[2], id: "flash", conceptIds: ["n1"] },
  ];
  const t = p.practiceHub(a, []).all;
  assert.deepEqual(
    p.roundQueue(t, "new", "mixed", 8).map((i) => i.id),
    ["q1", "flash", "q2", "hard"],
  );
  assert.deepEqual(
    p.roundQueue(t, "new", "quiz", 5).map((i) => i.id),
    ["q1", "q2"],
  );
});

test("orphan trees and nested main ideas each own questions exactly once", () => {
  const a = bank();
  a.concepts.push(
    { ...a.concepts[0], id: "orphan", label: "Orphan", main: false },
    { ...a.concepts[0], id: "root", label: "Root", main: false },
    { ...a.concepts[0], id: "nested", parentId: "root", main: true },
    { ...a.concepts[0], id: "leaf", parentId: "orphan", main: false },
    { ...a.concepts[0], id: "empty-orphan", main: false },
  );
  a.studyItems = [
    { ...a.studyItems[0], id: "orphan-q", conceptIds: ["leaf"] },
    { ...a.studyItems[0], id: "nested-q", conceptIds: ["nested", "n1"] },
  ];
  const hub = p.practiceHub(a, []);
  assert.equal(
    hub.topics.reduce((n, t) => n + t.total, 0),
    2,
  );
  assert.deepEqual(
    hub.topics.find((t) => t.id === "orphan")?.items.map((i) => i.id),
    ["orphan-q"],
  );
  assert.deepEqual(
    hub.topics.find((t) => t.id === "nested")?.items.map((i) => i.id),
    ["nested-q"],
  );
  assert.ok(hub.coverage.emptyTopics.some((t) => t.id === "empty-orphan"));
  assert.ok(
    hub.coverage.missingLanes.some(
      (t) => t.topicId === "orphan" && t.lane === "harder",
    ),
  );
});

test("retry variants never enter New or inflate original-basic readiness", () => {
  const hub = p.practiceHub(bank(), [attempt("q1")]);
  assert.deepEqual(
    hub.topics[0].lanes.new.map((i) => i.id),
    ["hard"],
  );
  assert.equal(hub.topics[0].basicTotal, 1);
  assert.equal(hub.topics[0].basicTried, 1);
  assert.equal(p.harderReady(hub.topics[0]).ready, true);
});

test("solid basics without available harder questions request missing questions instead of readiness", () => {
  const a = bank();
  a.studyItems = a.studyItems.filter((i) => i.id !== "hard");
  const hub = p.practiceHub(a, [attempt("q1")]);
  assert.equal(p.harderReady(hub.topics[0]).ready, false);
  assert.match(
    p.harderLockReason(hub.topics[0]),
    /Basics solid.*ask Go for harder/i,
  );
  assert.ok(
    hub.coverage.missingLanes.some(
      (m) => m.topicId === "n1" && m.lane === "harder",
    ),
  );
});
