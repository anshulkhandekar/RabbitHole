import { test } from "node:test";
import assert from "node:assert/strict";
import { connectionStrength } from "../apps/extension/src/connection-model";
test("connection strength counts distinct visible factual source pages, not repeated highlights or AI citations", () => {
  const captures: any[] = [
    { id: "a", sourceType: "article", url: "https://example.com/a" },
    { id: "h", sourceType: "highlight", url: "https://example.com/a#section" },
    { id: "b", sourceType: "article", url: "https://example.com/b" },
    { id: "q", sourceType: "search", url: "https://google.com/search?q=a" },
    {
      id: "ai",
      sourceType: "google_ai_overview",
      url: "https://google.com/search?q=a",
    },
  ];
  const session: any = { captures, hidden: [], removed: [] };
  assert.equal(
    connectionStrength(session, { captureIds: ["a", "h", "b", "q", "ai"] })
      .pages,
    2,
  );
  session.hidden = ["b"];
  assert.equal(
    connectionStrength(session, { captureIds: ["a", "b"] }).pages,
    1,
  );
  session.removed = ["a"];
  assert.equal(
    connectionStrength(session, { captureIds: ["a", "b", "unknown"] }).pages,
    0,
  );
});
