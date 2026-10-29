import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { Practice } from "../apps/extension/src/Practice";
import { analysis } from "./support";
import type { Session, AnalysisData } from "../packages/contracts/src/index";

async function render(extraActivity = false, answered = true) {
  const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  dom.window.HTMLElement.prototype.scrollTo = () => {};
  const a: AnalysisData = analysis();
  a.concepts[0].main = true;
  a.concepts[1].parentId = "n1";
  a.studyItems = [
    a.studyItems[0],
    { ...a.studyItems[0], id: "retry", variantOf: "q1", level: "transfer" },
    { ...a.studyItems[0], id: "hard", level: "transfer" },
  ];
  if (extraActivity)
    a.studyItems.push({
      ...analysis().studyItems[2],
      id: "untested-flashcard",
    });
  const session = {
    id: "s1",
    version: 1,
    analysis: a,
    captures: [],
    processed: [],
    attempts: (answered ? ["q1", "hard"] : []).map((studyId) => ({
      id: studyId,
      studyId,
      rating: "understood",
      choice: 1,
      confidence: "sure",
      analysisVersion: 1,
      timestamp: new Date().toISOString(),
    })),
    settings: {},
    status: "paused",
  } as unknown as Session;
  const requests: string[] = [],
    root = createRoot(document.getElementById("root")!);
  await act(async () =>
    root.render(
      React.createElement(Practice, {
        session,
        onReview: async () => true,
        onFeedback() {},
        onGenerate: (s) => requests.push(s),
        onToast() {},
      }),
    ),
  );
  const click = async (label: string) =>
    act(async () => {
      const b = [...document.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === label,
      );
      assert.ok(b, `button ${label}`);
      b.click();
    });
  return {
    dom,
    requests,
    click,
    async close() {
      await act(async () => root.unmount());
      dom.window.close();
    },
  };
}

test("Practice distinguishes unanswered questions, reserved retry versions and completed harder questions", async () => {
  const p = await render();
  try {
    assert.match(
      document.querySelector(".practice-topic")!.textContent!,
      /0 unanswered questions/,
    );
    assert.match(
      document.querySelector(".practice-topic")!.textContent!,
      /1 retry version/,
    );
    assert.match(document.body.textContent!, /already answered/i);
    assert.doesNotMatch(
      document.body.textContent!,
      /Review misses \(0, 0|Harder questions exist for/,
    );
  } finally {
    await p.close();
  }
});

test("the harder lane reports ready questions separately from locked saved questions", async () => {
  const p = await render(false, false);
  try {
    const card = [
      ...document.querySelectorAll<HTMLButtonElement>(".practice-lanes button"),
    ].find((b) => b.textContent!.includes("Harder practice"))!;
    assert.match(card.textContent!, /0 medium\/hard questions ready/);
    assert.match(
      card.textContent!,
      /1 saved medium\/hard question remains unanswered/,
    );
    assert.equal(card.disabled, true);
  } finally {
    await p.close();
  }
});

test("asking Go for questions first lets the user choose a count and difficulty", async () => {
  const p = await render();
  try {
    await p.click("Add questions");
    assert.equal(p.requests.length, 0);
    const input = document.querySelector<HTMLInputElement>(
      '[aria-label="Number of new questions"]',
    )!;
    assert.ok(input);
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        p.dom.window.HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "4");
      input.dispatchEvent(new p.dom.window.Event("input", { bubbles: true }));
    });
    for (const label of ["Easy — understand", "Hard — transfer"])
      await act(async () =>
        (
          document.querySelector(
            `input[aria-label="${label}"]`,
          ) as HTMLInputElement
        ).click(),
      );
    await p.click("Ask Go to add questions");
    assert.equal(p.requests.length, 1);
    assert.match(p.requests[0], /4 new questions/);
    assert.match(p.requests[0], /apply/);
    assert.equal(
      p.requests[0].match(/Requested levels: ([^.]+)\./)?.[1],
      "apply",
    );
    assert.match(p.requests[0], /ValidateSessionQuestions/);
    assert.match(p.requests[0], /plausible misconceptions/);
  } finally {
    await p.close();
  }
});

test("an exhausted activity does not claim every activity on the topic is exhausted", async () => {
  const p = await render(true);
  try {
    const quiz = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '[aria-label="Practice activity"] button',
      ),
    ].find((b) => b.textContent!.includes("Quiz"))!;
    await act(async () => quiz.click());
    assert.match(
      document.querySelector(".practice-exhausted h2")!.textContent!,
      /No unanswered quiz questions in this selection/i,
    );
    await p.click("Show other activities");
    assert.ok(
      [...document.querySelectorAll("button")].some((b) =>
        b.textContent!.startsWith("Start 1 new question"),
      ),
    );
  } finally {
    await p.close();
  }
});

test("question requests use whole-number counts and cannot send with no difficulty selected", async () => {
  const p = await render();
  try {
    await p.click("Add questions");
    const input = document.querySelector<HTMLInputElement>(
      '[aria-label="Number of new questions"]',
    )!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        p.dom.window.HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, "3.9");
      input.dispatchEvent(new p.dom.window.Event("input", { bubbles: true }));
    });
    await p.click("Ask Go to add questions");
    assert.match(p.requests[0], /Add 3 new questions/);
    await p.click("Add questions");
    for (const input of document.querySelectorAll<HTMLInputElement>(
      '.question-request input[type="checkbox"]',
    ))
      await act(async () => input.click());
    const button = [
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ].find((b) => b.textContent === "Ask Go to add questions")!;
    assert.equal(button.disabled, true);
  } finally {
    await p.close();
  }
});

test("the round switcher renders unanswered question counts rather than template syntax", async () => {
  const p = await render(false, false);
  try {
    const start = [
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ].find((b) => b.textContent?.startsWith("Start 2 new questions"))!;
    assert.ok(start);
    await act(async () => start.click());
    await act(async () =>
      document.querySelector<HTMLButtonElement>(".round-topic-button")!.click(),
    );
    const text = document.querySelector(
      '[aria-label="Switch practice topic"]',
    )!.textContent!;
    assert.match(text, /2 unanswered questions · 0 confident misses/);
    assert.doesNotMatch(text, /t\.untested|[{}]/);
  } finally {
    await p.close();
  }
});
