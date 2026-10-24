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
