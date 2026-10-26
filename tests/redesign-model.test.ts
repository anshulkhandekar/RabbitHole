import { test } from "node:test";
import assert from "node:assert/strict";
import { AnalysisInput, Study } from "../packages/contracts/src/index";
import { analysis } from "./support";
// Stripping the optional v2 contract fields would break links between Summary/Practice and the map.
test("v2 contract preserves summary, takeaway targets, route, main and per-item concepts", () => {
  const a = analysis();
  const parsed = AnalysisInput.parse({
    ...a,
    summary: "Summary",
    takeaways: [{ text: "A takeaway", concept: "n1" }],
    route: ["n1"],
    concepts: a.concepts.map((c) => ({ ...c, main: c.id === "n1" })),
  });
  assert.equal((parsed as any).summary, "Summary");
  assert.equal((parsed as any).takeaways[0].concept, "n1");
  assert.equal((parsed.concepts[0] as any).main, true);
  const item = Study.parse({ ...a.studyItems[0], concept: "n1" });
  assert.equal((item as any).concept, "n1");
});
