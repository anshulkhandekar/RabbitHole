import { randomUUID } from "node:crypto";
import {
  AnalysisInput,
  type AnalysisData,
} from "../../../packages/contracts/src/index";
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
      next: "Call SaveValidatedAnalysis with saveArguments to request normal user approval. Do not retype the guide. Nothing has been saved yet.",
    };
  }
  save(
    owner: string,
    input: { sessionId: string; validationId: string; title: string },
  ) {
    this.store.get(owner, input.sessionId);
    const draft = this.drafts.get(input.validationId);
    if (
      !draft ||
      draft.owner !== owner ||
      draft.payload.sessionId !== input.sessionId ||
      draft.expires <= this.now()
    )
      throw new DomainError(
        404,
        "Validated draft unavailable or expired. Re-run ValidateSessionAnalysis, then request approval with its new saveArguments.",
      );
    if (input.title !== draft.payload.title)
      throw new DomainError(
        422,
        "Draft title mismatch. Copy the saveArguments returned by validation.",
      );
    // Replays acknowledge the same save; they never increment its version twice.
    draft.result ??= this.store.save(owner, draft.payload);
    return draft.result;
  }
}
