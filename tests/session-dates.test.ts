import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { Summary } from "../apps/extension/src/Summary";
import { analysis } from "./support";
import type { Session } from "../packages/contracts/src/index";

test("an old session shows its original start separately from its guide update", () => {
  const session = {
    id: "s1",
    title: "Old research",
    analysis: analysis(),
    captures: [],
    attempts: [],
    createdAt: "2020-01-01T12:00:00Z",
    updatedAt: "2026-10-29T12:00:00Z",
    analyzedAt: "2026-10-29T12:00:00Z",
  } as unknown as Session;
  const dom = new JSDOM(
    renderToStaticMarkup(
      React.createElement(Summary, {
        session,
        onMap() {},
        onPractice() {},
        onWalk() {},
      }),
    ),
  );
  assert.equal(
    dom.window.document.querySelector("time")?.getAttribute("datetime"),
    session.createdAt,
  );
  assert.match(
    dom.window.document.querySelector(".eyebrow")!.textContent!,
    /Started.*2020.*Guide updated.*2026/,
  );
  dom.window.close();
});
