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
  if (session.version > h.version) {
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
      pendingFinds: h.captureIds.filter((id) => !session.processed.includes(id))
        .length,
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

export function savedReceipt(h: Handoff) {
  const pending = h.pendingFinds ?? 0;
  return `Saved v${h.savedVersion ?? h.version + 1}${pending ? ` · ${pending} ${pending === 1 ? "find" : "finds"} still waiting` : ""}`;
}

export function failedHandoffNote(h: Handoff, session: Session) {
  const submitted = new Set(h.captureIds),
    remaining = session.captures.filter(
      (c) =>
        submitted.has(c.id) &&
        !session.removed?.includes(c.id) &&
        !session.processed.includes(c.id),
    ).length;
  return `Your map hasn't changed. ${remaining ? `${remaining} ${remaining === 1 ? "find is" : "finds are"} still waiting.` : "None of the sent finds are waiting now."}`;
}
