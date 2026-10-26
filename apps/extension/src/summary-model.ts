import type {
  AnalysisData,
  Session,
} from "../../../packages/contracts/src/index";
export const routeIds = (a: AnalysisData) => a.route ?? a.overview?.route ?? [];
export function takeaways(a: AnalysisData) {
  return (
    a.takeaways?.map((t) => ({
      ...t,
      concept:
        t.concept ??
        [...a.concepts].sort(
          (x, y) => score(y.label, t.text) - score(x.label, t.text),
        )[0]?.id,
    })) ??
    (a.overview?.takeaways ?? a.concepts.flatMap((c) => c.takeaways ?? [])).map(
      (text) => ({
        text,
        concept: [...a.concepts].sort(
          (x, y) => score(y.label, text) - score(x.label, text),
        )[0]?.id,
      }),
    )
  );
}
function score(label: string, text: string) {
  return label
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 2 && text.toLowerCase().includes(w)).length;
}
export const shortTitle = (s: Session) =>
  s.short ??
  (s.title.includes(":") ? s.title.split(":")[0] : s.title.slice(0, 28));
