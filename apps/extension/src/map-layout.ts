import ELK from "elkjs/lib/elk.bundled.js";
import type {
  AnalysisData,
  CaptureData,
  Session,
} from "../../../packages/contracts/src/index";
import { chronological } from "./ui-model";
type Relation = AnalysisData["edges"][number];
export type MergedEdge = Relation & { ids: string[]; twoWay: boolean };
export type Box = { x: number; y: number; width: number; height: number };
export function boundedMapViewport(
  viewport: { x: number; y: number; zoom: number },
  nodes: Box[],
  width: number,
  height: number,
) {
  if (!nodes.length || width <= 0 || height <= 0) return viewport;
  const clamp = (offset: number, low: number, high: number, size: number) => {
    const padding = Math.min(160, size / 3),
      start = padding - low * viewport.zoom,
      end = size - padding - high * viewport.zoom;
    return Math.max(
      Math.min(start, end),
      Math.min(Math.max(start, end), offset),
    );
  };
  return {
    x: clamp(
      viewport.x,
      Math.min(...nodes.map((n) => n.x)),
      Math.max(...nodes.map((n) => n.x + n.width)),
      width,
    ),
    y: clamp(
      viewport.y,
      Math.min(...nodes.map((n) => n.y)),
      Math.max(...nodes.map((n) => n.y + n.height)),
      height,
    ),
    zoom: viewport.zoom,
  };
}
export type IdeaPosition = Box & {
  id: string;
  row: number;
  depth: number | null;
};
// Questions and attempts do not change card measurements or connection routes.
// Source visibility can change the graph without changing the saved version.
export function mapLayoutKey(
  session: Pick<Session, "id" | "analysis" | "captures">,
) {
  return `${session.id}:${JSON.stringify([
    session.analysis?.overview?.rootConceptId,
    session.analysis?.concepts.map((c) => [
      c.id,
      c.label,
      c.main,
      c.parentId,
      c.gap,
      c.captureIds,
    ]),
    session.analysis?.edges.map((e) => [e.id, e.source, e.target]),
    session.captures.map((c) => [c.id, c.timestamp]),
  ])}`;
}
export function mergeEdges(edges: Relation[]): MergedEdge[] {
  const groups = new Map<string, MergedEdge>();
  for (const e of edges) {
    if (e.source === e.target) continue;
    const key = [e.source, e.target].sort().join("|"),
      old = groups.get(key);
    if (old) {
      old.ids.push(e.id);
      old.twoWay ||= old.source === e.target;
      old.label = [...new Set([old.label, e.label])].join(" · ");
      old.captureIds = [...new Set([...old.captureIds, ...e.captureIds])];
      old.explanation += "\n" + e.explanation;
      if (e.evidenceKind === "supported") old.evidenceKind = "supported";
      old.evidence = [...(old.evidence ?? []), ...(e.evidence ?? [])];
    } else groups.set(key, { ...e, ids: [e.id], twoWay: false });
  }
  return [...groups.values()];
}
export function ideaDepths(analysis: AnalysisData, captures: CaptureData[]) {
  const trail = chronological(captures);
  return new Map(
    analysis.concepts.map((c) => {
      const found = c.captureIds
        .map((id) => trail.findIndex((x) => x.id === id))
        .filter((i) => i >= 0);
      return [c.id, found.length ? Math.min(...found) + 1 : null];
    }),
  );
}
const positionCache = new Map<
  string,
  Promise<{
    nodes: IdeaPosition[];
    rows: {
      depth: number | null;
      y: number;
      capture?: CaptureData;
      label?: string;
    }[];
  }>
>();
const previousLayouts = new Map<
  string,
  Promise<Awaited<ReturnType<typeof layoutIdeas>>>
>();
export function cachedLayoutIdeas(
  key: string,
  analysis: AnalysisData,
  captures: CaptureData[],
  sizes: Map<string, { width: number; height: number }>,
) {
  const signature =
    key +
    JSON.stringify([...sizes]) +
    JSON.stringify(analysis.edges.map((e) => [e.id, e.source, e.target])) +
    JSON.stringify([...ideaDepths(analysis, captures)]);
  let value = positionCache.get(signature);
  if (!value) {
    const sessionId = key.split(":")[0],
      previous = previousLayouts.get(sessionId);
    value = layoutIdeas(analysis, captures, sizes).then(async (layout) => {
      const before = await previous?.catch(() => undefined);
      if (!before) return layout;
      for (const row of layout.rows) {
        const members = layout.nodes.filter((n) =>
            row.label !== undefined
              ? n.row === layout.rows.indexOf(row)
              : n.depth === row.depth,
          ),
          fixed = members.filter((n) =>
            before.nodes.some(
              (old) =>
                old.id === n.id &&
                old.depth === n.depth &&
                (analysis.edges.length > 0 || old.row === n.row) &&
                old.width === n.width &&
                old.height === n.height,
            ),
          );
        for (const n of fixed)
          n.x = before.nodes.find((old) => old.id === n.id)!.x;
        const placed = [...fixed];
        for (const n of members
          .filter((n) => !fixed.includes(n))
          .sort((a, b) => a.x - b.x || a.id.localeCompare(b.id))) {
          if (
            placed.some(
              (p) => n.x < p.x + p.width + 64 && n.x + n.width + 64 > p.x,
            )
          )
            n.x = Math.max(0, ...placed.map((p) => p.x + p.width + 64));
          placed.push(n);
        }
      }
      return layout;
    });
    previousLayouts.set(sessionId, value);
    if (previousLayouts.size > 24)
      previousLayouts.delete(previousLayouts.keys().next().value!);
    positionCache.set(signature, value);
    value.catch(() => positionCache.delete(signature));
    if (positionCache.size > 24)
      positionCache.delete(positionCache.keys().next().value!);
  }
  return value;
}
export async function layoutIdeas(
  analysis: AnalysisData,
  captures: CaptureData[],
  sizes: Map<string, { width: number; height: number }>,
) {
  const depth = ideaDepths(analysis, captures),
    levels = [...new Set(depth.values())].sort(
      (a, b) => (a ?? Infinity) - (b ?? Infinity),
    );
  const edges = mergeEdges(analysis.edges),
    ids = new Set(analysis.concepts.map((c) => c.id));
  if (!edges.length) {
    const columns = Math.min(3, Math.ceil(Math.sqrt(analysis.concepts.length))),
      nodes: IdeaPosition[] = [],
      rows: {
        depth: number | null;
        y: number;
        capture?: CaptureData;
        label?: string;
      }[] = [];
    const width = Math.max(...[...sizes.values()].map((s) => s.width));
    let y = 80;
    for (let start = 0; start < analysis.concepts.length; start += columns) {
      const group = analysis.concepts.slice(start, start + columns),
        row = rows.length;
      const height = Math.max(
        ...group.map((c) => sizes.get(c.id)?.height ?? 0),
      );
      group.forEach((c, i) => {
        const size = sizes.get(c.id);
        if (!size?.width || !size.height)
          throw Error("Measure every idea before layout");
        nodes.push({
          id: c.id,
          x: i * (width + 64),
          y,
          ...size,
          row,
          depth: depth.get(c.id) ?? null,
        });
      });
      rows.push({
        depth: null,
        y: y + height / 2,
        label: start === 0 ? "Unconnected ideas" : "",
      });
      y += height + 64;
    }
    return { nodes, rows };
  }
  const graph = await new ELK().layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.partitioning.activate": "true",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.spacing.nodeNode": "64",
      "elk.layered.spacing.nodeNodeBetweenLayers": "96",
      "elk.edgeRouting": "SPLINES",
      "elk.randomSeed": "1",
    },
    children: analysis.concepts.map((c) => {
      const size = sizes.get(c.id);
      if (!size?.width || !size.height)
        throw Error("Measure every idea before layout");
      return {
        id: c.id,
        ...size,
        layoutOptions: {
          "elk.partitioning.partition": String(
            levels.indexOf(depth.get(c.id)!),
          ),
        },
      };
    }),
    edges: edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  });
  // ELK may create extra ranks for same-depth relationships. Preserve its crossing-minimised order,
  // then compact each depth into one measured row as required by the trail ruler.
  const byId = new Map(analysis.concepts.map((c) => [c.id, c]));
  const topicOf = (id: string) => {
    const seen = new Set<string>();
    while (!seen.has(id)) {
      seen.add(id);
      const c = byId.get(id);
      if (!c || c.main || !c.parentId || !byId.has(c.parentId)) return id;
      id = c.parentId;
    }
    return [...seen].sort()[0];
  };
  const topics = [...new Set(analysis.concepts.map((c) => topicOf(c.id)))],
    columnWidth = Math.max(...[...sizes.values()].map((s) => s.width)) + 80;
  const nodes: IdeaPosition[] = [],
    rows: {
      depth: number | null;
      y: number;
      capture?: CaptureData;
      label?: string;
    }[] = [];
  let y = 80;
  for (const [row, d] of levels.entries()) {
    const members = graph
      .children!.filter((c) => depth.get(c.id) === d)
      .sort((a, b) => (a.x ?? 0) - (b.x ?? 0) || a.id.localeCompare(b.id));
    const height = Math.max(...members.map((c) => c.height!));
    const occupied: { x: number; width: number }[] = [];
    for (const c of members) {
      let x = (topics.indexOf(topicOf(c.id)) % 3) * columnWidth;
      let overlap;
      while (
        (overlap = occupied.find(
          (p) => x < p.x + p.width + 64 && x + c.width! + 64 > p.x,
        ))
      )
        x = overlap.x + overlap.width + 80;
      occupied.push({ x, width: c.width! });
      nodes.push({
        id: c.id,
        x,
        y,
        width: c.width!,
        height: c.height!,
        row,
        depth: d,
      });
    }
    rows.push({
      depth: d,
      y: y + height / 2,
      capture: d ? chronological(captures)[d - 1] : undefined,
    });
    y += height + 150;
  }
  return { nodes, rows };
}
export function placeLabels(labels: (Box & { id: string })[], nodes: Box[]) {
  const placed: (Box & { id: string })[] = [];
  const overlaps = (a: Box, b: Box) =>
    a.x - a.width / 2 < b.x + b.width &&
    a.x + a.width / 2 > b.x &&
    a.y - a.height / 2 < b.y + b.height &&
    a.y + a.height / 2 > b.y;
  for (const label of labels) {
    let result = { ...label },
      found = false;
    for (let ring = 0; ring < 30 && !found; ring++)
      for (const sign of ring ? [1, -1] : [1]) {
        const candidate = { ...label, y: label.y + ring * 22 * sign };
        if (
          !nodes.some((n) => overlaps(candidate, n)) &&
          !placed.some((p) =>
            overlaps(candidate, {
              ...p,
              x: p.x - p.width / 2,
              y: p.y - p.height / 2,
            }),
          )
        ) {
          result = candidate;
          found = true;
          break;
        }
      }
    if (found) placed.push(result);
  }
  return placed;
}
export function connectionGeometry(
  e: MergedEdge,
  nodes: IdeaPosition[],
  edges: MergedEdge[],
) {
  const a = nodes.find((n) => n.id === e.source)!,
    b = nodes.find((n) => n.id === e.target)!;
  const cx = (n: IdeaPosition) => n.x + n.width / 2;
  const side = (n: IdeaPosition, o: IdeaPosition) =>
    n.row === o.row
      ? cx(o) > cx(n)
        ? "right"
        : "left"
      : o.y > n.y
        ? "bottom"
        : "top";
  const port = (n: IdeaPosition, o: IdeaPosition) => {
    const s = side(n, o),
      siblings = edges
        .filter((r) => r.source === n.id || r.target === n.id)
        .map((r) => ({
          r,
          other: nodes.find(
            (p) => p.id === (r.source === n.id ? r.target : r.source),
          )!,
        }))
        .filter((v) => v.other && side(n, v.other) === s)
        .sort(
          (u, v) => cx(u.other) - cx(v.other) || u.r.id.localeCompare(v.r.id),
        );
    const t =
      0.2 +
      (0.6 * (siblings.findIndex((v) => v.r.id === e.id) + 1)) /
        (siblings.length + 1);
    return s === "right"
      ? [n.x + n.width, n.y + n.height * t]
      : s === "left"
        ? [n.x, n.y + n.height * t]
        : [n.x + n.width * t, n.y + (s === "bottom" ? n.height : 0)];
  };
  const [sx, sy] = port(a, b),
    [tx, ty] = port(b, a);
  if (a.row === b.row) {
    const row = nodes.filter((n) => n.row === a.row).sort((u, v) => u.x - v.x);
    const distance = Math.abs(row.indexOf(a) - row.indexOf(b));
    if (distance === 1)
      return { path: `M${sx},${sy} L${tx},${ty}`, under: true };
    const lift =
      60 +
      14 *
        edges.filter(
          (r) =>
            r.id < e.id &&
            nodes.find((n) => n.id === r.source)?.row === a.row &&
            nodes.find((n) => n.id === r.target)?.row === a.row,
        ).length;
    return {
      path: `M${sx},${sy} C${sx},${a.y - lift} ${tx},${b.y - lift} ${tx},${ty}`,
      under: false,
    };
  }
  if (Math.abs(a.row - b.row) > 1) {
    const lane = edges.filter(
      (r) =>
        r.id < e.id &&
        Math.abs(
          (nodes.find((n) => n.id === r.source)?.row ?? 0) -
            (nodes.find((n) => n.id === r.target)?.row ?? 0),
        ) > 1,
    ).length;
    const min = Math.min(...nodes.map((n) => n.x)),
      max = Math.max(...nodes.map((n) => n.x + n.width));
    const skipCount = edges.filter(
      (r) =>
        Math.abs(
          (nodes.find((n) => n.id === r.source)?.row ?? 0) -
            (nodes.find((n) => n.id === r.target)?.row ?? 0),
        ) > 1,
    ).length;
    const outside =
      (sx + tx) / 2 < (min + max) / 2
        ? min - 48 - (skipCount - 1 - lane) * 18
        : max + 48 + (skipCount - 1 - lane) * 18;
    const down = b.row > a.row,
      startY = down
        ? Math.max(
            ...nodes.filter((n) => n.row === a.row).map((n) => n.y + n.height),
          ) +
          24 +
          lane * 14
        : Math.min(...nodes.filter((n) => n.row === a.row).map((n) => n.y)) -
          24 -
          lane * 14;
    const endY = down
      ? Math.min(...nodes.filter((n) => n.row === b.row).map((n) => n.y)) -
        24 -
        lane * 14
      : Math.max(
          ...nodes.filter((n) => n.row === b.row).map((n) => n.y + n.height),
        ) +
        24 +
        lane * 14;
    return {
      path: `M${sx},${sy} L${sx},${startY} C${sx},${startY} ${outside},${startY} ${outside},${startY} L${outside},${endY} C${outside},${endY} ${tx},${endY} ${tx},${endY} L${tx},${ty}`,
      under: false,
    };
  }
  const mid = (sy + ty) / 2;
  return {
    path: `M${sx},${sy} C${sx},${mid} ${tx},${mid} ${tx},${ty}`,
    under: false,
  };
}
type Point = { x: number; y: number };
function samplePath(path: string): Point[] {
  const tokens = path.match(/[MLC]|-?\d+(?:\.\d+)?/g) ?? [];
  let i = 0,
    x = 0,
    y = 0;
  const points: Point[] = [];
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === "M" || command === "L") {
      x = Number(tokens[i++]);
      y = Number(tokens[i++]);
      points.push({ x, y });
      continue;
    }
    if (command !== "C") break;
    const sx = x,
      sy = y,
      ax = Number(tokens[i++]),
      ay = Number(tokens[i++]),
      bx = Number(tokens[i++]),
      by = Number(tokens[i++]);
    x = Number(tokens[i++]);
    y = Number(tokens[i++]);
    for (let j = 1; j <= 32; j++) {
      const t = j / 32,
        u = 1 - t;
      points.push({
        x:
          u * u * u * sx +
          3 * u * u * t * ax +
          3 * u * t * t * bx +
          t * t * t * x,
        y:
          u * u * u * sy +
          3 * u * u * t * ay +
          3 * u * t * t * by +
          t * t * t * y,
      });
    }
  }
  return points;
}
export function edgeCrossings(routes: { id: string; path: string }[]) {
  const paths = routes.map((r) => ({ ...r, points: samplePath(r.path) })),
    gaps = new Map<string, Point[]>();
  for (let i = 0; i < paths.length; i++)
    for (let j = i + 1; j < paths.length; j++) {
      const a = paths[i],
        b = paths[j];
      for (let k = 1; k < a.points.length; k++)
        for (let l = 1; l < b.points.length; l++) {
          const p = a.points[k - 1],
            q = a.points[k],
            r = b.points[l - 1],
            s = b.points[l],
            dx = q.x - p.x,
            dy = q.y - p.y,
            ex = s.x - r.x,
            ey = s.y - r.y,
            den = dx * ey - dy * ex;
          if (Math.abs(den) < 1e-8) continue;
          const t = ((r.x - p.x) * ey - (r.y - p.y) * ex) / den,
            u = ((r.x - p.x) * dy - (r.y - p.y) * dx) / den;
          if (t < 0 || t > 1 || u < 0 || u > 1) continue;
          const point = { x: p.x + t * dx, y: p.y + t * dy };
          // Port endpoints remain intact; crossings inside either card are handled by routing instead.
          if (
            [a.points[0], a.points.at(-1)!, b.points[0], b.points.at(-1)!].some(
              (end) => Math.hypot(end.x - point.x, end.y - point.y) < 7,
            )
          )
            continue;
          const old = gaps.get(a.id) ?? [];
          if (!old.some((v) => Math.hypot(v.x - point.x, v.y - point.y) < 4)) {
            old.push(point);
            gaps.set(a.id, old);
          }
        }
    }
  return gaps;
}
