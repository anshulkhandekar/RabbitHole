import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import * as selection from "../apps/extension/src/selection";
const text = (document: Document) =>
  (selection as any).readSelection?.(document);
test("free selection returns page text but never editable content or ranges crossing it", () => {
  const dom = new JSDOM(
    '<p id="read">A useful mechanism worth keeping.</p><div contenteditable="true">Private draft</div><p id="end">More reading.</p>',
  );
  const doc = dom.window.document,
    select = dom.window.getSelection()!,
    range = doc.createRange();
  range.selectNodeContents(doc.querySelector("#read")!);
  select.addRange(range);
  assert.equal(text(doc), "A useful mechanism worth keeping.");
  select.removeAllRanges();
  range.selectNodeContents(doc.querySelector("[contenteditable]")!);
  select.addRange(range);
  assert.equal(text(doc), undefined);
  select.removeAllRanges();
  range.setStart(doc.querySelector("#read")!.firstChild!, 0);
  range.setEnd(doc.querySelector("#end")!.firstChild!, 5);
  select.addRange(range);
  assert.equal(text(doc), undefined);
  dom.window.close();
});
