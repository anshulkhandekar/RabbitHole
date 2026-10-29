import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { Trail } from "../apps/extension/src/Trail";
import { Practice, PracticeLoading } from "../apps/extension/src/Practice";
import { analysis, capture } from "./support";
import type { Session } from "../packages/contracts/src/index";

test("overview menus cannot exclude Google and Practice adds no nested main landmark", async () => {
  const dom = new JSDOM('<main id="root"></main>');
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  dom.window.HTMLElement.prototype.scrollTo = () => {};
  const root = createRoot(document.getElementById("root")!);
  const session = {
    id: "s1",
    version: 1,
    analysis: analysis(),
    attempts: [],
    processed: [],
    settings: {},
    captures: [
      {
        ...capture(),
        sourceType: "google_ai_overview",
        url: "https://www.google.com/search?q=gpu",
      },
    ],
  } as unknown as Session;
  await act(async () =>
    root.render(React.createElement(Trail, { session, onAction() {} })),
  );
  await act(async () =>
    (
      document.querySelector('[aria-label="Find actions"]') as HTMLButtonElement
    ).click(),
  );
  assert.doesNotMatch(
    document.querySelector('[role="menu"]')!.textContent!,
    /Never save/,
  );
  await act(async () =>
    root.render(
      React.createElement(Practice, {
        session,
        onReview: async () => true,
        onFeedback() {},
        onToast() {},
      }),
    ),
  );
  assert.equal(document.querySelectorAll("main main").length, 0);
  await act(async () => root.render(React.createElement(PracticeLoading, {})));
  assert.equal(document.querySelectorAll("main main").length, 0);
  await act(async () => root.unmount());
  dom.window.close();
});
