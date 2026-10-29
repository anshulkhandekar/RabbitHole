import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  AnalysisInput,
  type AnalysisData,
} from "../../../packages/contracts/src/index";
import { QuestionInput, appendQuestions } from "./question-model";
import { Store, DomainError } from "./store";

// A bounded, temporary cache of validated input, never a saved session analysis.
// Losing this cache on restart requires revalidation; it cannot bypass a save check.
export class AnalysisDrafts {
  private drafts = new Map<
    string,
    {
      owner: string;
      payload: AnalysisData;
      expires: number;
      result?: ReturnType<Store["save"]>;
      questionsOnly?: boolean;
    }
  >();
  constructor(
    private store: Store,
    private now = Date.now,
  ) {}
  validate(owner: string, input: unknown) {
    const payload = this.store.canonicalAnalysis(owner, input);
    this.store.validate(owner, payload);
    for (const [key, draft] of this.drafts)
      if (draft.expires <= this.now()) this.drafts.delete(key);
    while (this.drafts.size >= 32)
      this.drafts.delete(this.drafts.keys().next().value!);
    const validationId = randomUUID(),
      expires = this.now() + 30 * 60_000;
    this.drafts.set(validationId, {
      owner,
      payload: structuredClone(payload),
      expires,
    });
    return {
      valid: true,
      validationId,
      sessionId: payload.sessionId,
      expectedVersion: payload.expectedVersion,
      title: payload.title,
      expiresAt: new Date(expires).toISOString(),
      summary: payload.summary ?? payload.overview?.summary,
      concepts: payload.concepts.length,
      connections: payload.edges.length,
      activities: payload.studyItems.length,
      captures: payload.processedCaptureIds.length,
      saveArguments: {
        sessionId: payload.sessionId,
        validationId,
        title: payload.title,
      },
      next: "Copy the entire saveArguments object verbatim into SaveValidatedAnalysis to request normal user approval. Check its sessionId against the requested session before calling; sessionId and validationId are different values. Do not reconstruct, combine or swap IDs. Do not retype the guide. Nothing has been saved yet.",
    };
  }
  validateQuestions(owner: string, input: unknown) {
    try {
      const parsed = QuestionInput.safeParse(input);
      if (!parsed.success) throw parsed.error;
      const request = parsed.data,
        session = this.store.get(owner, request.sessionId);
      if (request.expectedVersion !== session.version)
        throw new DomainError(
          409,
          `Stale version: current version ${session.version}. Re-read GetSession before adding questions.`,
        );
      const payload = appendQuestions(session, request.questions),
        receipt = this.validate(owner, payload);
      this.drafts.get(receipt.validationId)!.questionsOnly = true;
      return receipt;
    } catch (e) {
      if (e instanceof DomainError) throw e;
      throw new DomainError(
        422,
        e instanceof z.ZodError
          ? `Invalid question payload: ${e.issues.map((i) => `${i.path.join(".") || "questions"}: ${i.message}`).join("; ")}. Re-read the visible guide, correct these fields or rebuild unsupported ideas, then validate again.`
          : e instanceof Error
            ? e.message
            : "Invalid questions. Correct the questions and validate again.",
      );
    }
  }

  save(
    owner: string,
    input: { sessionId: string; validationId: string; title: string },
  ) {
    const draft = this.drafts.get(input.validationId);
    if (!draft || draft.owner !== owner || draft.expires <= this.now())
      throw new DomainError(
        404,
        "Validated draft unavailable or expired. Re-run ValidateSessionAnalysis, then request approval with its new saveArguments.",
      );
    this.store.get(owner, draft.payload.sessionId);
    const saveArguments = {
      sessionId: draft.payload.sessionId,
      validationId: input.validationId,
      title: draft.payload.title,
    };
    if (
      input.sessionId !== draft.payload.sessionId ||
      input.title !== draft.payload.title
    )
      throw new DomainError(
        422,
        `${input.sessionId !== draft.payload.sessionId ? "Draft session mismatch" : "Draft title mismatch"}. Nothing was saved. Do not guess or combine IDs. Retry SaveValidatedAnalysis with these exact saveArguments: ${JSON.stringify(saveArguments)}`,
      );
    // Replays acknowledge the same save; they never increment its version twice.
    draft.result ??= draft.questionsOnly
      ? this.store.saveQuestions(owner, draft.payload)
      : this.store.save(owner, draft.payload);
    return draft.result;
  }
}
