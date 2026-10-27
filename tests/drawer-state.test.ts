import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { IdeaDrawer } from "../apps/extension/src/IdeaDrawer";
import { analysis } from "./support";
import type { Session } from "../packages/contracts/src/index";
test("each idea restores its own reading position when switching back", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const root = createRoot(document.getElementById("root")!);
  const session = {
    id: "s1",
    analysis: analysis(),
    attempts: [],
    captures: [],
    processed: [],
  } as unknown as Session;
  const show = async (id: string) =>
    act(async () =>
      root.render(
        React.createElement(IdeaDrawer, {
          session,
          selected: { kind: "concept", id },
          onSelect() {},
          onPractice() {},
          onWalk() {},
        }),
      ),
    );
  await show("n1");
  document.querySelector(".drawer-body")!.scrollTop = 180;
  await show("n2");
  assert.equal(document.querySelector(".drawer-body")!.scrollTop, 0);
  document.querySelector(".drawer-body")!.scrollTop = 40;
  await show("n1");
  assert.equal(document.querySelector(".drawer-body")!.scrollTop, 180);
  await act(async () => root.unmount());
  dom.window.close();
});
