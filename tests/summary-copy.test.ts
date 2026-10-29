import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { Summary } from "../apps/extension/src/Summary";
import { analysis, capture } from "./support";
import type { Session } from "../packages/contracts/src/index";

test("Summary uses singular source, idea, gap, and shaky-idea copy", () => {
  const a = analysis();
  a.concepts = [{ ...a.concepts[0], gap: "A missing detail." } as any];
  a.edges = [];
  a.studyItems = [{ ...a.studyItems[0], conceptIds: ["n1"] }];
  const session = {
    id: "s1",
    title: "Research",
    analysis: a,
    captures: [capture()],
    attempts: [
      {
        id: "a1",
        studyId: "q1",
        analysisVersion: 1,
        response: "",
        rating: "again",
        timestamp: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  } as Session;
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
  try {
    assert.match(
      dom.window.document.querySelector(".eyebrow")!.textContent!,
      /1 source ·/,
    );
    assert.deepEqual(
      [
        ...dom.window.document.querySelectorAll(".summary-stats button span"),
      ].map((el) => el.textContent),
      ["idea", "connections", "shaky idea", "gap"],
    );
    assert.match(
      dom.window.document.querySelector(".summary-next")!.textContent!,
      /1 idea is getting shaky/,
    );
  } finally {
    dom.window.close();
  }
});
