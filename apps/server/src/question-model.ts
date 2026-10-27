import { z } from "zod";
import {
  Id,
  Study,
  type Session,
  type AnalysisData,
} from "../../../packages/contracts/src/index";
const {
  captureIds: _sources,
  evidence: _quotes,
  ...questionShape
} = Study.shape;
// Question authors choose saved concepts. Source identities come from those concepts, never retyped by the author.
export const QuestionInput = z.object({
  sessionId: Id,
  expectedVersion: z.number().int().min(0),
  questions: z.array(z.object(questionShape)).min(1).max(40),
});
export function appendQuestions(
  session: Session,
  questions: z.infer<typeof QuestionInput>["questions"],
): AnalysisData {
  if (!session.analysis) throw Error("Save a map before adding questions.");
  const analysis = structuredClone(session.analysis),
    existing = new Set(analysis.studyItems.map((q) => q.id));
  const available = new Set(
    session.captures
      .filter(
        (c) =>
          !session.hidden?.includes(c.id) &&
          !session.removed?.includes(c.id) &&
          session.processed.includes(c.id),
      )
      .map((c) => c.id),
  );
  const additions = questions.map((q) => {
    if (existing.has(q.id))
      throw Error(
        `Question ${q.id} uses an existing ID. Give a new question a new ID; existing questions are preserved.`,
      );
    existing.add(q.id);
    const ids = [
      ...new Set([
        ...q.conceptIds,
        ...(q.concept ? [q.concept] : []),
        ...(q.pairs ?? []).flatMap((pair) =>
          pair.concept ? [pair.concept] : [],
        ),
      ]),
    ];
    if (
      !ids.length ||
      ids.some((id) => !analysis.concepts.some((c) => c.id === id))
    )
      throw Error(
        `Unknown question concept: ${ids.join(", ")}. Valid concept IDs: ${analysis.concepts.map((c) => c.id).join(", ")}. Copy the intended concept ID exactly.`,
      );
    const captureIds = [
      ...new Set(
        analysis.concepts
          .filter((c) => ids.includes(c.id))
          .flatMap((c) => c.captureIds),
      ),
    ].filter((id) => available.has(id));
    if (!captureIds.length)
      throw Error(
        `Concepts ${ids.join(", ")} have no visible processed sources. Capture supporting evidence or rebuild the map first.`,
      );
    return Study.parse({ ...q, conceptIds: ids, captureIds });
  });
  if (analysis.studyItems.length + additions.length > 40)
    throw Error(
      `Only ${40 - analysis.studyItems.length} question slots remain. Submit fewer new questions; do not delete existing ones.`,
    );
  return {
    ...analysis,
    sessionId: session.id,
    expectedVersion: session.version,
    intent: "rebuild",
    processedCaptureIds: [],
    studyItems: [...analysis.studyItems, ...additions],
  };
}
