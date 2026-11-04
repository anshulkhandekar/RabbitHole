import type { Session } from "./index";

// Search navigation parameters can change when a saved Google result is reopened.
// A search records the query; articles and highlights retain exact source attribution.
export function captureIdentity(
  capture: Pick<Session["captures"][number], "sourceType" | "url" | "text">,
) {
  return JSON.stringify(
    capture.sourceType === "search"
      ? [capture.sourceType, capture.text]
      : [capture.sourceType, capture.url, capture.text],
  );
}
