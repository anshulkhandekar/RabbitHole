import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { analysis } from "./support";
import type { Session, Attempt } from "../packages/contracts/src/index";
// react-dom decides at import time whether text input events are supported,
// so the DOM must exist before React loads.
const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
});
dom.window.HTMLElement.prototype.scrollTo = () => {};
const React = (await import("react")).default,
  { act } = await import("react"),
  { createRoot } = await import("react-dom/client"),
  { Practice } = await import("../apps/extension/src/Practice");
test("the reasoning typed after a miss is saved with the attempt", async () => {
  const saved: Attempt[] = [];
  const session = {
    id: "s1",
    version: 1,
    title: "Test",
    analysis: analysis(),
    attempts: [],
    captures: [],
    processed: [],
    status: "paused",
    settings: {},
    createdAt: "2026-10-25T00:00:00Z",
    updatedAt: "2026-10-25T00:00:00Z",
  } as unknown as Session;
  const root = createRoot(document.getElementById("root")!);
  await act(async () =>
    root.render(
      React.createElement(Practice, {
        session,
        edgeId: "n2",
        onReview: async (a: Attempt) => {
          saved.push(a);
          return true;
        },
        onFeedback: () => {},
        onToast: () => {},
      }),
    ),
  );
  const click = (el: Element) =>
    act(async () =>
      el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })),
    );
  await click(document.querySelectorAll(".run-options button")[0]);
  const note = document.querySelector<HTMLTextAreaElement>(
    ".miss-note textarea",
  )!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      dom.window.HTMLTextAreaElement.prototype,
      "value",
    )!.set!.call(note, "  I mixed up the two  ");
    note.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
  await click(
    [...document.querySelectorAll(".feedback-sheet button")].find((b) =>
      b.textContent?.startsWith("Continue"),
    )!,
  );
  assert.equal(saved.at(-1)!.note, "I mixed up the two");
  assert.equal(saved[0].confidence, undefined);
  await act(async () => root.unmount());
  dom.window.close();
});
