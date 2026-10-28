import type { Session } from "../../../packages/contracts/src/index";
import { visibleEvidence } from "./ui-model";
/** Evidence breadth, not a probability or a claim that Go's inference is true. */
export function connectionStrength(
  session: Session,
  edge: { captureIds: string[] },
) {
  const visible = new Set(visibleEvidence(session, edge.captureIds)),
    urls = new Set<string>();
  for (const capture of session.captures) {
    if (
      !visible.has(capture.id) ||
      !["article", "highlight"].includes(capture.sourceType)
    )
      continue;
    try {
      const url = new URL(capture.url);
      url.hash = "";
      urls.add(url.href);
    } catch {}
  }
  const pages = urls.size;
  return {
    pages,
    label: pages
      ? `${pages} source page${pages === 1 ? "" : "s"}`
      : "No captured page support",
    weight: Math.min(3, pages),
  };
}
