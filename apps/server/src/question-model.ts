import { z } from "zod";
import {
  Id,
  Study,
  type Session,
  type AnalysisData,
} from "../../../packages/contracts/src/index";
import { visibleAnalysis } from "../../../packages/contracts/src/sources";
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
  const analysis = visibleAnalysis(session)!,
    existing = new Set(session.analysis.studyItems.map((q) => q.id));
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
    const unsupported = analysis.concepts.filter(
      (c) =>
        ids.includes(c.id) && !c.captureIds.some((id) => available.has(id)),
    );
    if (unsupported.length)
      throw Error(
        `Ideas ${unsupported.map((c) => `${c.label} (${c.id})`).join(", ")} have no visible processed sources. Unhide supporting sources or rebuild the map before adding questions for these ideas.`,
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
    const parsed = Study.safeParse({ ...q, conceptIds: ids, captureIds });
    if (!parsed.success)
      throw Error(
        `Question ${q.id}: ${parsed.error.issues.map((i) => i.message).join("; ")}. Correct the question and validate again.`,
      );
    return parsed.data;
  });
  if (session.analysis.studyItems.length + additions.length > 40)
    throw Error(
      `Only ${40 - session.analysis.studyItems.length} question slots remain. Submit fewer new questions; do not delete existing ones.`,
    );
  // Validate only the visible supported projection; the save path appends questions
  // to the original guide, so hiding and unhiding never erases prior material.
  const concepts = analysis.concepts.filter((c) =>
    c.captureIds.some((id) => available.has(id)),
  );
  const conceptIds = new Set(concepts.map((c) => c.id));
  for (const c of concepts) {
    let parent = c.parentId;
    const seen = new Set<string>();
    while (parent && !conceptIds.has(parent) && !seen.has(parent)) {
      seen.add(parent);
      parent = analysis.concepts.find((c) => c.id === parent)?.parentId;
    }
    c.parentId = parent && conceptIds.has(parent) ? parent : undefined;
    if (c.buildsOn) c.buildsOn = c.buildsOn.filter((id) => conceptIds.has(id));
  }
  const studyItems = analysis.studyItems.filter(
    (q) =>
      q.captureIds.length &&
      q.conceptIds.every((id) => conceptIds.has(id)) &&
      (!q.concept || conceptIds.has(q.concept)) &&
      (q.pairs ?? []).every((p) => !p.concept || conceptIds.has(p.concept)),
  );
  const studyIds = new Set(studyItems.map((q) => q.id)),
    newIds = new Set(additions.map((q) => q.id));
  for (const q of additions) {
    if (!q.variantOf || studyIds.has(q.variantOf) || newIds.has(q.variantOf))
      continue;
    if (session.analysis.studyItems.some((saved) => saved.id === q.variantOf))
      throw Error(
        `Question ${q.id} is a variant of ${q.variantOf}, whose supporting sources are hidden or deleted. Unhide them or choose a visible question as variantOf; nothing was saved.`,
      );
    throw Error(
      `Question ${q.id} has an unknown variantOf ID: ${q.variantOf}. Choose a visible saved question or another new question in this request; nothing was saved.`,
    );
  }
  for (const q of studyItems)
    if (q.variantOf && !studyIds.has(q.variantOf)) q.variantOf = undefined;
  const route = analysis.overview?.route.filter((id) => conceptIds.has(id));
  return {
    ...analysis,
    concepts,
    edges: analysis.edges.filter(
      (e) =>
        e.captureIds.length &&
        conceptIds.has(e.source) &&
        conceptIds.has(e.target),
    ),
    overview:
      analysis.overview && conceptIds.has(analysis.overview.rootConceptId)
        ? {
            ...analysis.overview,
            route: route?.length ? route : [analysis.overview.rootConceptId],
          }
        : undefined,
    route: analysis.route?.filter((id) => conceptIds.has(id)),
    takeaways: analysis.takeaways?.filter(
      (t) => !t.concept || conceptIds.has(t.concept),
    ),
    sessionId: session.id,
    expectedVersion: session.version,
    intent: "rebuild",
    processedCaptureIds: [],
    studyItems: [...studyItems, ...additions],
  };
}
