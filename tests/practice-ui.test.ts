import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { Practice } from "../apps/extension/src/Practice";
import { analysis } from "./support";
import type { Session, Attempt } from "../packages/contracts/src/index";
// Ending after instant feedback must retain that answer rather than silently discard it.
test("ending a run after answering saves the answer and opens results", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  dom.window.HTMLElement.prototype.scrollTo = () => {};
  const saved: Attempt[] = [],
    session = {
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
        onReview: async (a) => {
          saved.push(a);
          return true;
        },
        onFeedback: () => {},
        onToast: () => {},
      }),
    ),
  );
  const click = async (el: Element) =>
    act(async () =>
      el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })),
    );
  await click(
    [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.startsWith("Start"),
    )!,
  );
  await click(document.querySelectorAll(".run-options button")[1]);
  assert.match(document.body.textContent!, /That’s right/);
  await click(document.querySelector('[aria-label="End practice"]')!);
  assert.equal(saved.length, 1);
  assert.match(document.body.textContent!, /Deep dig\./);
  assert.match(document.body.textContent!, /1\/1/);
  await act(async () => root.unmount());
  dom.window.close();
});
// Wrong pairs must remain available; correct pairs lock immediately, including right-first selection.
test("matching locks each correct pair immediately and keeps wrong picks playable", async () => {
  const { Matching } = await import("../apps/extension/src/Matching");
  const dom = new JSDOM('<div id="root"></div>');
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
    ResizeObserver: class {
      observe() {}
      disconnect() {}
    },
    requestAnimationFrame: () => 0,
  });
  const root = createRoot(document.getElementById("root")!),
    completed: { slips: number; missed: string[] }[] = [];
  const item = {
    ...analysis().studyItems[0],
    type: "matching" as const,
    pairs: [
      { left: "A", right: "one", concept: "n1" },
      { left: "B", right: "two", concept: "n2" },
    ],
  };
  await act(async () =>
    root.render(
      React.createElement(Matching, {
        item,
        onComplete: (slips, missed) => completed.push({ slips, missed }),
      }),
    ),
  );
  const pick = async (side: string, i: number) =>
    act(async () =>
      document
        .querySelector(`[data-${side}="${i}"]`)!
        .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })),
    );
  await pick("left", 0);
  await pick("right", 1);
  assert.equal(document.querySelectorAll("button:disabled").length, 0);
  await pick("right", 0);
  await pick("left", 0);
  assert.equal(document.querySelectorAll("button:disabled").length, 2);
  assert.equal(completed.length, 0);
  await pick("left", 1);
  await pick("right", 1);
  assert.equal(document.querySelectorAll("button:disabled").length, 4);
  assert.deepEqual(completed, [{ slips: 1, missed: ["n1", "n2"] }]);
  await act(async () => root.unmount());
  dom.window.close();
});

// Switching must preserve checked answers and discard an unchecked pick.
test("topic switcher ends a round without saving an unchecked quiz pick", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  dom.window.HTMLElement.prototype.scrollTo = () => {};
  const saved: Attempt[] = [];
  const session = {
    id: "s1",
    version: 1,
    analysis: analysis(),
    attempts: [],
    captures: [],
    processed: [],
    settings: {},
    status: "paused",
  } as unknown as Session;
  const root = createRoot(document.getElementById("root")!);
  await act(async () =>
    root.render(
      React.createElement(Practice, {
        session,
        onReview: async (a) => {
          saved.push(a);
          return true;
        },
        onFeedback: () => {},
        onToast: () => {},
      }),
    ),
  );
  const click = async (el: Element) =>
    act(async () => {
      el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    });
  const nav = document.querySelector('nav[aria-label="Practice topics"]');
  assert.ok(nav, "hub offers main topics");
  await click(
    [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.startsWith("Start"),
    )!,
  );
  await click(document.querySelectorAll(".run-options button")[1]);
  await click(document.querySelector('[aria-haspopup="dialog"]')!);
  assert.match(document.body.textContent!, /unchecked pick/);
  await click(document.querySelector('[data-switch-topic="n1"]')!);
  assert.equal(saved.length, 0);
  assert.equal(document.querySelector('[aria-expanded="true"]'), null);
  await act(async () => root.unmount());
  dom.window.close();
});
