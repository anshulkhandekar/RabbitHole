import { test } from "node:test";
import assert from "node:assert/strict";
import { boundedMapViewport } from "../apps/extension/src/map-layout";

test("panning past a small map returns to its perimeter without changing zoom", () => {
  const nodes = [{ x: 200, y: 100, width: 300, height: 200 }];
  assert.deepEqual(
    boundedMapViewport({ x: -10000, y: 10000, zoom: 1 }, nodes, 1000, 600),
    { x: -40, y: 140, zoom: 1 },
  );
  const inside = { x: 100, y: 100, zoom: 1 };
  assert.deepEqual(boundedMapViewport(inside, nodes, 1000, 600), inside);
});

test("large zoomed maps keep their outer edges reachable, and empty maps are unchanged", () => {
  const nodes = [{ x: 0, y: 0, width: 2000, height: 1400 }],
    far = { x: -10000, y: -10000, zoom: 2 };
  assert.deepEqual(boundedMapViewport(far, nodes, 1000, 600), {
    x: -3160,
    y: -2360,
    zoom: 2,
  });
  assert.deepEqual(boundedMapViewport(far, [], 1000, 600), far);
});
