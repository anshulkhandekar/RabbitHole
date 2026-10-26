import type {
  AnalysisData,
  Attempt,
} from "../../../packages/contracts/src/index";
export type StudyItem = AnalysisData["studyItems"][number];
export type Memory = "strong" | "shaky" | "untested";
export type Result = "right" | "wrong" | "partial";
export function conceptsOf(item: StudyItem) {
  return [
    ...new Set([
      ...(item.concept ? [item.concept] : item.conceptIds),
      ...(item.pairs ?? []).flatMap((p) => (p.concept ? [p.concept] : [])),
    ]),
  ];
}
export function attemptResult(
  item: StudyItem,
  a: Attempt,
  id?: string,
): Result {
  if (item.type === "matching") {
    try {
      const metadata = JSON.parse(a.response);
      if (
        metadata.v === 2 &&
        metadata.slips > 0 &&
        (!id ||
          !metadata.missedConcepts?.length ||
          metadata.missedConcepts.includes(id))
      )
        return "partial";
    } catch {}
  }
  return a.rating === "understood"
    ? "right"
    : a.rating === "partly"
      ? "partial"
      : "wrong";
}
export function deriveMemory(
  analysis: AnalysisData,
  attempts: Attempt[],
  now = Date.now(),
): Record<string, Memory> {
  const result: Record<string, Memory> = {};
  for (const c of analysis.concepts) {
    const relevant = attempts
      .map((a) => ({
        a,
        item: analysis.studyItems.find((i) => i.id === a.studyId),
      }))
      .filter(
        (v): v is { a: Attempt; item: StudyItem } =>
          !!v.item && conceptsOf(v.item).includes(c.id),
      )
      .sort((x, y) => x.a.timestamp.localeCompare(y.a.timestamp));
    if (!relevant.length) {
      result[c.id] = "untested";
      continue;
    }
    const last = relevant.at(-1)!,
      recent = relevant.filter(
        (v) => now - Date.parse(v.a.timestamp) <= 30 * 86400000,
      ),
      net = recent.reduce(
        (n, v) => n + (attemptResult(v.item, v.a, c.id) === "right" ? 1 : -1),
        0,
      );
    result[c.id] =
      attemptResult(last.item, last.a, c.id) === "right" && net > 0
        ? "strong"
        : "shaky";
  }
  return result;
}
export function quickQueue(
  items: StudyItem[],
  memory: Record<string, Memory>,
): StudyItem[] {
  const pattern: StudyItem["type"][] = [
    "quiz",
    "matching",
    "connection",
    "flashcard",
    "quiz",
    "flashcard",
    "quiz",
    "connection",
  ];
  const rank = (i: StudyItem) =>
    conceptsOf(i).filter((id) => memory[id] === "shaky").length;
  const ranked = [...items].sort(
      (a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id),
    ),
    used = new Map<string, number>();
  if (!items.length) return [];
  return pattern.map((type) => {
    const choices = ranked.filter((i) => i.type === type),
      pool = choices.length ? choices : ranked;
    const chosen = [...pool].sort(
      (a, b) =>
        (used.get(a.id) ?? 0) - (used.get(b.id) ?? 0) || rank(b) - rank(a),
    )[0];
    used.set(chosen.id, (used.get(chosen.id) ?? 0) + 1);
    return chosen;
  });
}
export function connectionQueue(
  analysis: AnalysisData,
  edgeId: string,
): StudyItem[] {
  const edge = analysis.edges.find((e) => e.id === edgeId);
  if (!edge) return [];
  const saved = analysis.studyItems.filter(
    (i) =>
      i.type === "connection" &&
      conceptsOf(i).includes(edge.source) &&
      conceptsOf(i).includes(edge.target),
  );
  if (saved.length) return saved;
  const label = (id: string) =>
    analysis.concepts.find((c) => c.id === id)?.label ?? id;
  return [
    {
      id: "edge_" + edge.id,
      type: "connection",
      prompt: `How does ${label(edge.source)} ${edge.label} ${label(edge.target)}?`,
      answer: edge.explanation,
      conceptIds: [edge.source, edge.target],
      captureIds: edge.captureIds,
      evidence: edge.evidence,
    },
  ];
}
