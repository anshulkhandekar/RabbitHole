import type { AnalysisData, Session } from "./index";

export function visibleCaptureIds(
  session: Pick<Session, "captures" | "hidden" | "removed">,
  ids: string[],
) {
  const withheld = new Set([
    ...(session.hidden ?? []),
    ...(session.removed ?? []),
  ]);
  const available = new Set(session.captures.map((c) => c.id));
  return ids.filter((id) => available.has(id) && !withheld.has(id));
}

// Filter a view, never the saved guide: unhiding a source restores its receipts.
// Unsupported ideas remain visible until a rebuild, but carry no removed quotes.
export function visibleAnalysis(session: Session): AnalysisData | null {
  const a = session.analysis;
  if (!a) return null;
  const filter = <
    T extends {
      captureIds: string[];
      evidence?: { captureId: string; quote: string }[];
    },
  >(
    item: T,
  ): T => {
    const captureIds = visibleCaptureIds(session, item.captureIds);
    return {
      ...item,
      captureIds,
      ...(item.evidence && {
        evidence: item.evidence.filter((e) => captureIds.includes(e.captureId)),
      }),
    };
  };
  return {
    ...a,
    processedCaptureIds: visibleCaptureIds(session, a.processedCaptureIds),
    concepts: a.concepts.map(filter),
    edges: a.edges.map(filter),
    studyItems: a.studyItems.map(filter),
  };
}
