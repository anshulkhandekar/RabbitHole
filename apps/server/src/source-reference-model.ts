import { createHash } from "node:crypto";
import type { AnalysisData } from "../../../packages/contracts/src/index";
// Stable across pages, deletions and restarts. These are exact aliases, never fuzzy UUID repair.
export const sourceRef = (id: string) =>
  "src_" + createHash("sha256").update(id).digest("hex").slice(0, 16);
export function resolveSourceReference(value: string, ids: string[]) {
  const matches = ids.filter((id) => id === value || sourceRef(id) === value);
  return matches.length === 1 ? matches[0] : value;
}
export function canonicalSourceReferences(
  payload: AnalysisData,
  ids: string[],
): AnalysisData {
  const resolve = (id: string) => resolveSourceReference(id, ids),
    result = structuredClone(payload);
  result.processedCaptureIds = result.processedCaptureIds.map(resolve);
  for (const item of [
    ...result.concepts,
    ...result.edges,
    ...result.studyItems,
  ]) {
    item.captureIds = item.captureIds.map(resolve);
    if (item.evidence)
      item.evidence = item.evidence.map((e) => ({
        ...e,
        captureId: resolve(e.captureId),
      }));
  }
  return result;
}
