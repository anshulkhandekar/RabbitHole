import type { Session } from "../../../packages/contracts/src/index";
import type { Handoff } from "./handoff";
export const handoffPending = (h?: Handoff) =>
  h?.status === "waiting" || h?.status === "stalled";
export function advanceHandoff(
  h: Handoff,
  session: Session,
  before?: Session,
  now = Date.now(),
): Handoff {
  if (!handoffPending(h)) return h;
  if (
    session.version > h.version &&
    h.captureIds.every((id) => session.processed.includes(id))
  ) {
    const oldIdeas = new Set(before?.analysis?.concepts.map((c) => c.id) ?? []),
      oldQuestions = new Set(
        before?.analysis?.studyItems.map((q) => q.id) ?? [],
      );
    return {
      ...h,
      status: "saved",
      savedAt: new Date(now).toISOString(),
      ideas:
        session.analysis?.concepts.filter((c) => !oldIdeas.has(c.id)).length ??
        0,
      questions:
        session.analysis?.studyItems.filter((q) => !oldQuestions.has(q.id))
          .length ?? 0,
      finds: h.captureIds.length,
      savedVersion: session.version,
    };
  }
  if (h.captureIds.some((id) => session.removed?.includes(id)))
    return {
      ...h,
      status: "failed",
      reason: "A find sent to Go was deleted. Send the remaining finds again.",
    };
  if (now - Date.parse(h.startedAt) >= 600000)
    return { ...h, status: "stalled" };
  return h;
}
