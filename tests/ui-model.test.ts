import { test } from "node:test";
import assert from "node:assert/strict";
import { analysisDelta } from "../apps/extension/src/ui-model";
import { Review } from "../packages/contracts/src/index";
import { analysis } from "./support";

test("updated counts compare stable IDs rather than pretend every concept is new", () => {
  const before = analysis();
  const after = {
    ...before,
    concepts: [...before.concepts, { ...before.concepts[0], id: "n3" }],
  };
  assert.deepEqual(analysisDelta(before, after), { ideas: 1, connections: 0 });
});
test("partial self-assessment remains distinct from missed and understood", () => {
  const parsed = Review.parse({
    id: "a1",
    studyId: "r1",
    analysisVersion: 1,
    rating: "partly",
    timestamp: "2026-10-24T12:00:00.000Z",
  });
  assert.equal(parsed.rating, "partly");
});
