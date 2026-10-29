import { test } from "node:test";
import assert from "node:assert/strict";
import { mapLayoutKey } from "../apps/extension/src/map-layout";
import { analysis, capture } from "./support";
import type { Session } from "../packages/contracts/src/index";

test("question-only saves preserve the map layout identity, but visible topology changes invalidate it", () => {
  const session = {
    id: "s1",
    version: 1,
    analysis: analysis(),
    captures: [capture()],
  } as unknown as Session;
  const initial = mapLayoutKey(session);
  const questions = structuredClone(session);
  questions.version = 3;
  questions.analysis!.studyItems.push({
    ...questions.analysis!.studyItems[0],
    id: "topup",
  });
  assert.equal(mapLayoutKey(questions), initial);
  const graph = structuredClone(questions);
  graph.analysis!.concepts.push({
    ...graph.analysis!.concepts[0],
    id: "restored",
  });
  graph.analysis!.edges.push({
    ...graph.analysis!.edges[0],
    id: "restored-link",
    target: "restored",
  });
  assert.notEqual(mapLayoutKey(graph), initial);
  const renamed = structuredClone(session);
  renamed.analysis!.concepts[0].label =
    "A much longer label requiring a new measurement";
  assert.notEqual(mapLayoutKey(renamed), initial);
  const rootChanged = structuredClone(session);
  rootChanged.analysis!.overview = {
    rootConceptId: "n2",
    summary: "New organizing idea",
    takeaways: [],
    route: [],
  };
  assert.notEqual(
    mapLayoutKey(rootChanged),
    initial,
    "legacy main-card styling can follow the overview root",
  );
});
