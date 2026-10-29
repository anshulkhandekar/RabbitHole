import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { IdeaDrawer } from "../apps/extension/src/IdeaDrawer";
import { analysis } from "./support";
import type { Session, AnalysisData } from "../packages/contracts/src/index";

test("an inferred connection has its own heading and separate navigable endpoints", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const a: AnalysisData = analysis();
  a.edges[0].label = "Roles create interaction boundaries";
  a.edges[0].evidenceKind = "inference";
  const selected: any[] = [],
    root = createRoot(document.getElementById("root")!);
  try {
    await act(async () =>
      root.render(
        React.createElement(IdeaDrawer, {
          session: {
            id: "s1",
            analysis: a,
            captures: [],
            attempts: [],
          } as unknown as Session,
          selected: { kind: "edge", id: "e1" },
          onSelect: (s) => selected.push(s),
          onPractice() {},
          onWalk() {},
        }),
      ),
    );
    assert.equal(
      document.querySelector("h2")!.textContent,
      "Roles create interaction boundaries",
    );
    const endpoints = document.querySelector('[aria-label="Connected ideas"]');
    assert.ok(endpoints);
    const links = endpoints.querySelectorAll<HTMLButtonElement>("button");
    assert.equal(links.length, 2);
    assert.equal(links[0].textContent, "GPU");
    await act(async () => links[1].click());
    assert.deepEqual(selected, [{ kind: "concept", id: "n2" }]);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});
