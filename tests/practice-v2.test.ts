import { test } from "node:test";
import assert from "node:assert/strict";
import * as p from "../apps/extension/src/practice-model";
import { analysis } from "./support";
const a = analysis();
// Losing a recent miss behind older successes would incorrectly paint an idea strong.
test("memory reflects recent misses, stale successes, and untested ideas", () => {
  const now = Date.parse("2026-10-25T12:00:00Z");
  const attempts = [
    {
      id: "a",
      studyId: "q1",
      rating: "understood" as const,
      timestamp: "2026-10-25T10:00:00Z",
      analysisVersion: 1,
      response: "",
    },
    {
      id: "b",
      studyId: "q1",
      rating: "again" as const,
      timestamp: "2026-10-25T11:00:00Z",
      analysisVersion: 1,
      response: "",
    },
  ];
  assert.equal(p.deriveMemory(a, attempts, now).n1, "shaky");
  assert.equal(p.deriveMemory(a, attempts.slice(0, 1), now).n1, "strong");
  assert.equal(p.deriveMemory(a, [], now).n1, "untested");
  assert.equal(
    p.deriveMemory(
      a,
      [{ ...attempts[0], timestamp: "2026-01-01T00:00:00Z" }],
      now,
    ).n1,
    "shaky",
  );
});
// Grouping activities by type would turn a mixed dig back into a worksheet.
test("quick dig interleaves available activities and prioritizes shaky ideas", () => {
  const items = [
    ...a.studyItems.map((i) => ({ ...i, concept: "n1" })),
    { ...a.studyItems[0], id: "q2", conceptIds: ["n2"] },
    {
      ...a.studyItems[0],
      id: "m1",
      type: "matching" as const,
      pairs: [
        { left: "a", right: "b", concept: "n1" },
        { left: "c", right: "d", concept: "n2" },
      ],
    },
  ];
  const queue = p.quickQueue(items, { n1: "strong", n2: "shaky" });
  assert.equal(queue.length, 8);
  assert.deepEqual(
    queue.map((i) => i.type),
    [
      "quiz",
      "matching",
      "connection",
      "flashcard",
      "quiz",
      "flashcard",
      "quiz",
      "connection",
    ],
  );
  assert.equal(queue[0].id, "q2");
});
// Final correct pairs must not erase the slips that happened while learning them.
test("matching slips affect memory without changing the checked final matches", () => {
  const item = {
    ...a.studyItems[0],
    id: "m",
    type: "matching" as const,
    pairs: [
      { left: "a", right: "b", concept: "n1" },
      { left: "c", right: "d", concept: "n2" },
    ],
  };
  const memory = p.deriveMemory(
    { ...a, studyItems: [item] },
    [
      {
        id: "m1",
        studyId: "m",
        rating: "understood",
        timestamp: "2026-10-25T10:00:00Z",
        analysisVersion: 1,
        response: JSON.stringify({ v: 2, slips: 1, missedConcepts: ["n1"] }),
        matches: [0, 1],
      },
    ],
    Date.parse("2026-10-25T12:00:00Z"),
  );
  assert.equal(memory.n1, "shaky");
  assert.equal(memory.n2, "strong");
});
// A selected link must not accidentally practice a different link sharing just one endpoint.
test("connection selection requires both endpoints and can reveal an unsaved link honestly", () => {
  const other = { ...a.studyItems[1], id: "other", conceptIds: ["n1", "n3"] };
  assert.deepEqual(
    p
      .connectionQueue({ ...a, studyItems: [a.studyItems[1], other] }, "e1")
      .map((i) => i.id),
    ["r1"],
  );
  const fallback = p.connectionQueue({ ...a, studyItems: [] }, "e1");
  assert.equal(fallback[0].answer, a.edges[0].explanation);
  assert.equal(fallback[0].id, "edge_e1");
});
