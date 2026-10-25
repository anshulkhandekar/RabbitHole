import { test } from "node:test";
import assert from "node:assert/strict";
import {
  depthLayout,
  tunnelPath,
  analysisDelta,
} from "../apps/extension/src/ui-model";
import { Review } from "../packages/contracts/src/index";
import { analysis, capture } from "./support";

// Wrong evidence ordering must move the chamber to the wrong row and fail this check.
test("map depth comes from earliest actual evidence and respects gaps in the trail", () => {
  const a = analysis();
  a.concepts = [
    { ...a.concepts[0], captureIds: ["c4", "c2"] },
    { ...a.concepts[1], captureIds: ["c4"] },
  ];
  const captures = [1, 2, 3, 4].map((i) => ({
    ...capture(`c${i}`),
    tag: "none" as const,
    references: [],
    timestamp: `2026-10-24T12:0${i}:00.000Z`,
  }));
  const layout = depthLayout(a.concepts, captures);
  assert.deepEqual(
    layout.nodes.map((n) => [n.id, n.depth, n.row, n.y]),
    [
      ["n1", 2, 0, 0],
      ["n2", 4, 1, 150],
    ],
  );
  assert.deepEqual(
    layout.rows.map((r) => r.depth),
    [2, 4],
  );
  assert.equal(
    depthLayout([{ ...a.concepts[0], captureIds: ["missing"] }], captures)
      .nodes[0].depth,
    null,
  );
});
test("same-row tunnels use a straight adjacent route and an arc for distant chambers", () => {
  const a = { x: 0, y: 0, width: 100, row: 0 },
    b = { x: 164, y: 0, width: 100, row: 0 },
    c = { x: 328, y: 0, width: 100, row: 0 };
  assert.match(tunnelPath(a, b, true).path, / L/);
  assert.match(tunnelPath(a, c, false).path, / C/);
  assert.ok(tunnelPath(a, { ...b, y: 150, row: 1 }, true).labelY > 0);
});
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

test("opposite tunnels between the same chambers get separate routes and labels", () => {
  const a = { x: 0, y: 0, width: 120, row: 0 },
    b = { x: 0, y: 150, width: 120, row: 1 };
  const first = tunnelPath(a, b, false, -18),
    second = tunnelPath(b, a, false, 18);
  assert.notEqual(first.labelY, second.labelY);
  assert.notEqual(first.path, second.path);
});

// The hub must be the saved root, not whichever label happens to sort first.
import * as model from "../apps/extension/src/ui-model";
test("radial map honors the saved root and gives it a larger chamber than its details", () => {
  const a: any = analysis();
  a.overview = {
    rootConceptId: "n2",
    summary: "Main idea",
    takeaways: ["A major point"],
    route: ["n2", "n1"],
  };
  a.concepts[0].parentId = "n2";
  const layout = (model as any).radialLayout?.(a, []);
  assert.equal(layout?.rootId, "n2");
  assert.ok(
    layout.nodes.find((n: any) => n.id === "n2").width >
      layout.nodes.find((n: any) => n.id === "n1").width,
  );
  const root = layout.nodes.find((n: any) => n.id === "n2");
  assert.equal(root.x + root.width / 2, 0);
  assert.equal(root.y + root.height / 2, 0);
});
test("legacy radial grouping uses existing edges and labels its root as a layout choice", () => {
  const layout = (model as any).radialLayout?.(analysis(), []);
  assert.equal(layout?.authored, false);
  assert.equal(layout?.nodes.length, 2);
  assert.equal(layout?.nodes.find((n: any) => n.id === "n2").parentId, "n1");
});

test("reverse radial relationships keep their labels on separate sides of the tunnel", () => {
  const a = {
      id: "a",
      x: 0,
      y: 0,
      width: 280,
      height: 158,
      row: 0,
      depth: 1,
      isRoot: true,
    },
    b = {
      id: "b",
      x: 400,
      y: 0,
      width: 224,
      height: 80,
      row: 1,
      depth: 2,
      isRoot: false,
    };
  const first = model.radialTunnelPath(a, b, -15),
    second = model.radialTunnelPath(b, a, 15);
  assert.notEqual(first.labelY, second.labelY);
  assert.notEqual(first.path, second.path);
});

test("overview hides details until their branch is selected and full view restores cross-branch ideas", () => {
  const nodes = [
    { id: "root", row: 0 },
    { id: "a", row: 1, parentId: "root" },
    { id: "b", row: 1, parentId: "root" },
    { id: "a1", row: 2, parentId: "a" },
    { id: "b1", row: 2, parentId: "b" },
  ];
  const overview = (model as any).radialVisibleIds?.(
    nodes,
    "root",
    null,
    false,
  );
  assert.deepEqual(overview, ["root", "a", "b"]);
  assert.deepEqual(
    (model as any).radialVisibleIds?.(nodes, "root", "a1", false),
    ["root", "a", "a1"],
  );
  assert.deepEqual(
    (model as any).radialVisibleIds?.(nodes, "root", null, true),
    ["root", "a", "b", "a1", "b1"],
  );
});
