import { test } from "node:test";
import assert from "node:assert/strict";
import * as model from "../apps/extension/src/map-layout";
import { analysis, capture } from "./support";
// Drawing reverse relationships separately would fail this: preserve both meanings in one path.
test("merges reverse edges and retains their evidence and identities", () => {
  const a = analysis();
  const e = a.edges[0];
  const merged = model.mergeEdges([
    e,
    {
      ...e,
      id: "reverse",
      source: e.target,
      target: e.source,
      label: "reverse meaning",
    },
  ]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].ids, [e.id, "reverse"]);
  assert.match(merged[0].label, /reverse meaning/);
});
// Using estimated widths or mixing partitions would overlap these unusually wide measured cards.
test("measured layered layout respects depth and has no overlapping cards", async () => {
  const a = analysis();
  const caps = [
    {
      ...capture("c1"),
      timestamp: "2026-10-24T10:00:00.000Z",
      tag: "none" as const,
      references: [],
    },
    {
      ...capture("c2"),
      tag: "none" as const,
      references: [],
      timestamp: "2026-10-25T12:00:00.000Z",
    },
  ];
  a.concepts[1].captureIds = ["c2"];
  a.concepts.push({ ...a.concepts[0], id: "n3" });
  const sizes = new Map(
    a.concepts.map((c, i) => [c.id, { width: 300 + i * 100, height: 80 }]),
  );
  const result = await model.layoutIdeas(a, caps, sizes);
  const x = result.nodes.find((n) => n.id === "n1")!,
    y = result.nodes.find((n) => n.id === "n2")!;
  for (let i = 0; i < result.nodes.length; i++)
    for (const other of result.nodes.slice(i + 1)) {
      const n = result.nodes[i];
      assert.ok(
        n.x + n.width <= other.x ||
          other.x + other.width <= n.x ||
          n.y + n.height <= other.y ||
          other.y + other.height <= n.y,
      );
    }
  assert.equal(x.width, 300);
  assert.ok(y.y >= x.y + x.height + 96);
  assert.deepEqual(result, await model.layoutIdeas(a, caps, sizes));
});

test("main-topic branches at different source depths retain distinct columns", async () => {
  const a = analysis();
  a.concepts = [
    { ...a.concepts[0], main: true },
    { ...a.concepts[1], main: true, captureIds: ["c2"] },
    {
      ...a.concepts[0],
      id: "n3",
      label: "A third independent topic",
      main: true,
      captureIds: ["c3"],
    },
    {
      ...a.concepts[0],
      id: "detail",
      label: "A detail",
      parentId: "n2",
      captureIds: ["c4"],
    },
  ] as any;
  a.edges = [a.edges[0], { ...a.edges[0], id: "branch", target: "n3" }];
  const caps = [1, 2, 3, 4].map((i) => ({
    ...capture(`c${i}`),
    timestamp: `2026-10-2${i}T10:00:00.000Z`,
    tag: "none" as const,
    references: [],
  }));
  const result = await model.layoutIdeas(
    a,
    caps,
    new Map(a.concepts.map((c) => [c.id, { width: 240, height: 80 }])),
  );
  const second = result.nodes.find((n) => n.id === "n2")!,
    third = result.nodes.find((n) => n.id === "n3")!,
    detail = result.nodes.find((n) => n.id === "detail")!;
  assert.notEqual(
    second.x,
    third.x,
    "independent topics must not collapse into one chronological column",
  );
  assert.equal(detail.x, second.x, "details stay in their main topic's column");
  assert.ok(third.y > second.y, "source depth remains truthful");
});
// A label at the path midpoint would collide; placement must search beyond the node bounds.
test("label placement avoids nodes and previously placed labels", () => {
  const result = model.placeLabels(
    [
      { id: "a", x: 50, y: 20, width: 90, height: 20 },
      { id: "b", x: 50, y: 20, width: 90, height: 20 },
    ],
    [{ x: 0, y: 0, width: 100, height: 40 }],
  );
  assert.equal(result.length, 2);
  assert.ok(Math.abs(result[0].y - result[1].y) >= 20);
  assert.ok(
    result.every((r) => r.y - r.height / 2 >= 40 || r.y + r.height / 2 <= 0),
  );
});
// A long relationship drawn through the middle column must not pass through intervening cards.
test("relationships skipping depth rows route outside intervening cards", () => {
  const nodes = [
    { id: "a", x: 0, y: 0, width: 180, height: 50, row: 0, depth: 1 },
    { id: "middle", x: 0, y: 200, width: 180, height: 50, row: 1, depth: 2 },
    { id: "b", x: 0, y: 400, width: 180, height: 50, row: 2, depth: 3 },
  ];
  const e = {
    ...analysis().edges[0],
    id: "long",
    source: "a",
    target: "b",
    ids: ["long"],
    twoWay: false,
  };
  const geometry = model.connectionGeometry(e, nodes, [e]);
  let x = 0,
    y = 0;
  const points: { x: number; y: number }[] = [];
  for (const command of geometry.path.match(/[MLC][^MLC]*/g) ?? []) {
    const numbers = command
        .slice(1)
        .match(/-?\d+(?:\.\d+)?/g)!
        .map(Number),
      sx = x,
      sy = y;
    if (command[0] === "M") {
      [x, y] = numbers;
      continue;
    }
    if (command[0] === "L") {
      [x, y] = numbers;
      for (let j = 0; j <= 100; j++)
        points.push({
          x: sx + ((x - sx) * j) / 100,
          y: sy + ((y - sy) * j) / 100,
        });
    } else {
      const [ax, ay, bx, by, tx, ty] = numbers;
      for (let j = 0; j <= 100; j++) {
        const t = j / 100,
          u = 1 - t;
        points.push({
          x:
            u ** 3 * sx + 3 * u * u * t * ax + 3 * u * t * t * bx + t ** 3 * tx,
          y:
            u ** 3 * sy + 3 * u * u * t * ay + 3 * u * t * t * by + t ** 3 * ty,
        });
      }
      x = tx;
      y = ty;
    }
  }
  assert.ok(
    points.every((p) => p.x <= 0 || p.x >= 180 || p.y <= 200 || p.y >= 250),
    "No part of the route may enter the middle card",
  );
});
// A bridge must break only the underlying stroke at a crossing, never detach a shared endpoint.
test("crossing bridges separate visible strokes without breaking endpoints", () => {
  const gaps = model.edgeCrossings([
    { id: "horizontal", path: "M0,50 L100,50" },
    { id: "vertical", path: "M50,0 L50,100" },
    { id: "joined", path: "M100,50 L150,100" },
  ]);
  assert.deepEqual(gaps.get("horizontal"), [{ x: 50, y: 50 }]);
  assert.equal(gaps.has("vertical"), false);
  assert.equal(gaps.has("joined"), false);
});
// Adding a new idea must not shift an unchanged measured card merely because its ID sorts earlier.
test("cached analysis revisions retain unchanged idea positions", async () => {
  const a = analysis();
  a.concepts = [a.concepts[0]];
  a.edges = [];
  const caps = [{ ...capture("c1"), tag: "none" as const, references: [] }],
    sizes = new Map([["n1", { width: 180, height: 50 }]]);
  const before = await model.cachedLayoutIdeas(
    "stable-session:1",
    a,
    caps,
    sizes,
  );
  const changed = {
    ...a,
    concepts: [{ ...a.concepts[0], id: "n0" }, ...a.concepts],
  };
  sizes.set("n0", { width: 180, height: 50 });
  const after = await model.cachedLayoutIdeas(
      "stable-session:2",
      changed,
      caps,
      sizes,
    ),
    original = after.nodes.find((n) => n.id === "n1")!,
    added = after.nodes.find((n) => n.id === "n0")!;
  assert.equal(original.x, before.nodes[0].x);
  assert.ok(
    added.x + added.width + 64 <= original.x ||
      original.x + original.width + 64 <= added.x,
  );
});

test("unconnected ideas form compact rows without fabricating edges or losing evidence depths", async () => {
  const a = analysis();
  a.edges = [];
  a.concepts = Array.from({ length: 6 }, (_, i) => ({
    ...a.concepts[0],
    id: `idea${i}`,
    captureIds: [`c${i}`],
  }));
  const caps = a.concepts.map((_, i) => ({
    ...capture(`c${i}`),
    tag: "none" as const,
    references: [],
    timestamp: `2026-10-27T10:0${i}:00.000Z`,
  }));
  const layout = await model.layoutIdeas(
    a,
    caps,
    new Map(a.concepts.map((c) => [c.id, { width: 180, height: 60 }])),
  );
  assert.ok(new Set(layout.nodes.map((n) => n.x)).size > 1);
  assert.ok(Math.max(...layout.nodes.map((n) => n.y)) < 600);
  assert.deepEqual(
    layout.nodes.map((n) => n.depth),
    [1, 2, 3, 4, 5, 6],
  );
  assert.equal(a.edges.length, 0);
});
