import type {
  AnalysisData,
  CaptureData,
} from "../../../packages/contracts/src/index";
export type ChamberPosition = {
  id: string;
  x: number;
  y: number;
  width: number;
  row: number;
  depth: number | null;
};
export function chronological(captures: CaptureData[]) {
  return [...captures].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
export function depthLayout(
  concepts: AnalysisData["concepts"],
  captures: CaptureData[],
) {
  const trail = chronological(captures),
    depthById = new Map(trail.map((c, i) => [c.id, i + 1]));
  const depths = concepts.map((c) => {
    const found = c.captureIds
      .map((id) => depthById.get(id))
      .filter((v): v is number => v !== undefined);
    return found.length ? Math.min(...found) : null;
  });
  const distinct = [...new Set(depths)].sort(
    (a, b) => (a ?? Infinity) - (b ?? Infinity),
  );
  const nodes: ChamberPosition[] = [];
  distinct.forEach((depth, row) => {
    const members = concepts
      .map((c, i) => ({ c, depth: depths[i] }))
      .filter((c) => c.depth === depth);
    const widths = members.map(({ c }) =>
      Math.max(120, c.label.length * 7.6 + 40),
    );
    let x =
      -(widths.reduce((a, b) => a + b, 0) + 64 * (members.length - 1)) / 2;
    members.forEach(({ c }, i) => {
      nodes.push({ id: c.id, x, y: row * 150, width: widths[i], row, depth });
      x += widths[i] + 64;
    });
  });
  return {
    nodes: concepts.map((c) => nodes.find((n) => n.id === c.id)!),
    rows: distinct.map((depth, row) => ({
      depth,
      y: row * 150,
      capture: depth ? trail[depth - 1] : undefined,
    })),
  };
}
export function tunnelPath(
  a: Omit<ChamberPosition, "id" | "depth">,
  b: Omit<ChamberPosition, "id" | "depth">,
  adjacent: boolean,
  lane = 0,
) {
  const ax = a.x + a.width / 2,
    bx = b.x + b.width / 2;
  let path: string,
    labelX = (ax + bx) / 2,
    labelY: number;
  if (a.row === b.row && adjacent) {
    const right = bx > ax;
    path = `M${ax + (right ? a.width / 2 : -a.width / 2)},${a.y + 23} L${bx + (right ? -b.width / 2 : b.width / 2)},${b.y + 23}`;
    labelY = a.y + 62;
  } else if (a.row === b.row) {
    const lift = 46 + Math.abs(bx - ax) * 0.12;
    path = `M${ax},${a.y} C${ax},${a.y - lift} ${bx},${b.y - lift} ${bx},${b.y}`;
    labelY = a.y - lift * 0.75;
  } else {
    const down = b.y > a.y,
      sy = a.y + (down ? 46 : 0),
      ey = b.y + (down ? 0 : 46),
      k = (ey - sy) * 0.5;
    path = `M${ax},${sy} C${ax + lane},${sy + k} ${bx + lane},${ey - k} ${bx},${ey}`;
    labelY = (sy + ey) / 2;
  }
  return { path, labelX: labelX + lane / 2, labelY: labelY + lane };
}
export function analysisDelta(
  before: AnalysisData | null | undefined,
  after: AnalysisData,
) {
  return {
    ideas: after.concepts.filter(
      (c) => !before?.concepts.some((old) => old.id === c.id),
    ).length,
    connections: after.edges.filter(
      (e) => !before?.edges.some((old) => old.id === e.id),
    ).length,
  };
}
export const sourceKind = (c: CaptureData) =>
  c.sourceType === "google_ai_overview" ? "overview" : c.sourceType;
export const sourceVerb = (c: CaptureData) =>
  ({
    search: "Searched",
    article: "Read",
    highlight: "Highlighted",
    google_ai_overview: "AI Overview",
  })[c.sourceType];
export const domain = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "Original source";
  }
};
export const time = (s: string) =>
  new Date(s).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export type RadialPosition = ChamberPosition & {
  height: number;
  parentId?: string;
  isRoot: boolean;
};
export function radialLayout(analysis: AnalysisData, captures: CaptureData[]) {
  const degree = (id: string) =>
    analysis.edges.filter((e) => e.source === id || e.target === id).length;
  const rootId =
    analysis.overview?.rootConceptId ??
    [...analysis.concepts].sort((a, b) => degree(b.id) - degree(a.id))[0]?.id;
  const ids = new Set(analysis.concepts.map((c) => c.id)),
    parents = new Map<string, string>();
  for (const c of analysis.concepts)
    if (
      c.id !== rootId &&
      c.parentId &&
      ids.has(c.parentId) &&
      c.parentId !== c.id
    )
      parents.set(c.id, c.parentId);
  const seen = new Set<string>(),
    queue = rootId ? [rootId] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const c of analysis.concepts)
      if (parents.get(c.id) === id) queue.push(c.id);
    for (const e of analysis.edges) {
      const other =
        e.source === id ? e.target : e.target === id ? e.source : undefined;
      if (
        other &&
        other !== rootId &&
        !seen.has(other) &&
        !parents.has(other)
      ) {
        parents.set(other, id);
        queue.push(other);
      }
    }
  }
  const level = (id: string, path = new Set<string>()): number => {
    if (id === rootId) return 0;
    const parent = parents.get(id);
    if (!parent || path.has(id)) return 1;
    return 1 + level(parent, new Set([...path, id]));
  };
  const children = (id: string) =>
    analysis.concepts.filter((c) => parents.get(c.id) === id);
  const weight = (id: string, path = new Set<string>()): number => {
    if (path.has(id)) return 1;
    return Math.max(
      1,
      children(id).reduce(
        (n, c) => n + weight(c.id, new Set([...path, id])),
        0,
      ),
    );
  };
  const angles = new Map<string, number>();
  function place(
    id: string,
    start: number,
    end: number,
    path = new Set<string>(),
  ) {
    if (path.has(id)) return;
    angles.set(id, (start + end) / 2);
    const cs = children(id),
      total = cs.reduce((n, c) => n + weight(c.id), 0);
    let angle = start;
    for (const c of cs) {
      const span = ((end - start) * weight(c.id)) / Math.max(1, total);
      place(c.id, angle, angle + span, new Set([...path, id]));
      angle += span;
    }
  }
  const branches = analysis.concepts.filter(
      (c) =>
        c.id !== rootId && (parents.get(c.id) === rootId || !parents.has(c.id)),
    ),
    total = branches.reduce((n, c) => n + weight(c.id), 0);
  let angle = -Math.PI;
  for (const c of branches) {
    const span = (2 * Math.PI * weight(c.id)) / Math.max(1, total);
    place(c.id, angle, angle + span);
    angle += span;
  }
  const depths = depthLayout(analysis.concepts, captures);
  const nodes: RadialPosition[] = analysis.concepts.map((c) => {
    const row = level(c.id),
      isRoot = c.id === rootId,
      width = isRoot ? 280 : row === 1 ? 252 : 208,
      height = isRoot ? 190 : row === 1 ? 104 : 80;
    const count = analysis.concepts.filter(
        (other) => level(other.id) === row,
      ).length,
      radius = isRoot ? 0 : Math.max(row * 340, (count * 330) / (Math.PI * 2)),
      a = angles.get(c.id) ?? 0;
    return {
      id: c.id,
      x: Math.cos(a) * radius - width / 2,
      y: Math.sin(a) * radius - height / 2,
      width,
      height,
      row,
      depth: depths.nodes.find((n) => n.id === c.id)?.depth ?? null,
      parentId: parents.get(c.id),
      isRoot,
    };
  });
  return { nodes, rows: depths.rows, rootId, authored: !!analysis.overview };
}
export function radialTunnelPath(
  a: RadialPosition,
  b: RadialPosition,
  lane = 0,
) {
  const ax = a.x + a.width / 2,
    ay = a.y + a.height / 2,
    bx = b.x + b.width / 2,
    by = b.y + b.height / 2,
    dx = bx - ax,
    dy = by - ay;
  const boundary = (w: number, h: number) =>
    Math.min(Math.abs(w / 2 / (dx || 0.001)), Math.abs(h / 2 / (dy || 0.001)));
  const ta = boundary(a.width, a.height),
    tb = boundary(b.width, b.height),
    sx = ax + dx * ta,
    sy = ay + dy * ta,
    tx = bx - dx * tb,
    ty = by - dy * tb;
  const length = Math.max(1, Math.hypot(dx, dy)),
    direction = dx > 0 || (dx === 0 && dy >= 0) ? 1 : -1,
    ox = (-dy / length) * lane * direction,
    oy = (dx / length) * lane * direction;
  return {
    path: `M${sx},${sy} C${sx + (tx - sx) * 0.4 + ox},${sy + (ty - sy) * 0.1 + oy} ${sx + (tx - sx) * 0.6 + ox},${sy + (ty - sy) * 0.9 + oy} ${tx},${ty}`,
    labelX: (sx + tx) / 2 + ox,
    labelY: (sy + ty) / 2 + oy,
  };
}

export function radialVisibleIds(
  nodes: { id: string; row: number; parentId?: string }[],
  rootId: string,
  selected: string | null,
  all = false,
) {
  if (all) return nodes.map((n) => n.id);
  if (!selected || selected === rootId || !nodes.some((n) => n.id === selected))
    return nodes.filter((n) => n.row <= 1).map((n) => n.id);
  let branch = selected;
  const seen = new Set<string>();
  while (!seen.has(branch)) {
    seen.add(branch);
    const parent = nodes.find((n) => n.id === branch)?.parentId;
    if (!parent || parent === rootId) break;
    branch = parent;
  }
  const belongs = (id: string) => {
    const visited = new Set<string>();
    let current: string | undefined = id;
    while (current && !visited.has(current)) {
      if (current === branch) return true;
      visited.add(current);
      current = nodes.find((n) => n.id === current)?.parentId;
    }
    return false;
  };
  return nodes.filter((n) => n.id === rootId || belongs(n.id)).map((n) => n.id);
}
