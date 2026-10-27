import type {
  AnalysisData,
  CaptureData,
  Session,
} from "../../../packages/contracts/src/index";
import { visibleCaptureIds } from "../../../packages/contracts/src/sources";
export function chronological(captures: CaptureData[]) {
  return [...captures].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
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
export const googleSearchUrl = (q: string) =>
  "https://www.google.com/search?q=" + encodeURIComponent(q);
// Evidence the user still keeps: hidden or deleted sources drop out of view.
export function visibleEvidence(
  session: Pick<Session, "captures" | "hidden" | "removed">,
  ids: string[],
) {
  return visibleCaptureIds(session, ids);
}
