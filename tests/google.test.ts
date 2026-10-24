import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { googleQuery, overview } from "../apps/extension/src/google";
test("Google adapter recognizes supported search URLs but excludes impersonators and non-search pages", () => {
  assert.equal(
    googleQuery("https://www.google.com/search?q=Blackwell+architecture"),
    "Blackwell architecture",
  );
  assert.equal(googleQuery("https://google.evil.com/search?q=private"), null);
  assert.equal(googleQuery("https://www.google.com/mail?q=private"), null);
});
test("overview adapter declines unlabeled or hidden content instead of inventing extraction", () => {
  const doc = new JSDOM(
    '<div>AI Overview text elsewhere</div><div aria-label="AI Overview" hidden>Hidden material</div>',
  ).window.document;
  assert.equal(overview(doc), null);
});
