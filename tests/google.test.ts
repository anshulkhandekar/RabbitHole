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

test("AI overview detection supports labelled regions and heading-labelled containers without capturing results", () => {
  const variants = [
    '<section aria-label="AI Overview"><p>Aluminium and magnesium alloys offer a useful combination of low mass and rigidity for laptop enclosures.</p></section>',
    '<section aria-labelledby="ai-heading"><h2 id="ai-heading">AI Overview</h2><p>Aluminium and magnesium alloys offer a useful combination of low mass and rigidity for laptop enclosures.</p></section>',
    '<div data-attrid="SGEAnswer"><div role="heading">AI Overview</div><p>Aluminium and magnesium alloys offer a useful combination of low mass and rigidity for laptop enclosures.</p></div>',
  ];
  for (const html of variants) {
    const doc = new JSDOM(
      html +
        "<main>Unrelated organic search results must not be included.</main>",
    ).window.document;
    Object.defineProperty(
      doc.defaultView!.HTMLElement.prototype,
      "getClientRects",
      { value: () => [{ width: 200, height: 100 }] },
    );
    const result = overview(doc);
    assert.ok(result);
    assert.match(result.text, /low mass and rigidity/);
    assert.doesNotMatch(result.text, /organic search/);
  }
});
