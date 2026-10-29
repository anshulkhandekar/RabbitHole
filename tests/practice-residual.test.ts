import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { analysis } from "./support";
import { worker } from "./worker-harness";
import type {
  Session,
  Attempt,
  AnalysisData,
} from "../packages/contracts/src/index";
const dom = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
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
dom.window.HTMLElement.prototype.scrollTo = () => {};
const React = (await import("react")).default;
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { Practice } = await import("../apps/extension/src/Practice");
const click = async (el: Element | undefined | null) => {
  assert.ok(el);
  await act(async () => (el as HTMLElement).click());
};
const button = (text: RegExp) =>
  [...document.querySelectorAll("button")].find((b) =>
    text.test(b.textContent!),
  );
async function show(extra: Partial<Session> = {}, props: object = {}) {
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
    ...extra,
  } as Session;
  const root = createRoot(document.getElementById("root")!);
  await act(async () =>
    root.render(
      React.createElement(Practice, {
        session,
        onReview: async () => true,
        onFeedback() {},
        onToast() {},
        ...props,
      }),
    ),
  );
  return { session, dispose: async () => act(async () => root.unmount()) };
}
function single(type: "quiz" | "matching" = "quiz"): AnalysisData {
  const a = analysis() as AnalysisData;
  a.concepts = [{ ...a.concepts[0], main: true }];
  a.studyItems = [
    {
      ...a.studyItems[0],
      type,
      conceptIds: ["n1"],
      pairs:
        type === "matching"
          ? [
              { left: "A", right: "one", concept: "n1" },
              { left: "B", right: "two", concept: "n1" },
            ]
          : undefined,
    },
  ];
  return a;
}
for (const type of ["quiz", "matching"] as const)
  test(`checked ${type} survives remount before Continue and records only once`, async () => {
    const app = worker({ id: 7, url: "https://example.org/gpu" });
    const id = (await app.request("start", { title: "Test" })).active;
    Object.assign(app.local.state.sessions[id], {
      version: 1,
      analysis: single(type),
    });
    const p = await show(app.local.state.sessions[id], {
      edgeId: "quick",
      onReview: async (attempt: Attempt) => {
        const result = await app.request("review", { id, attempt });
        return !result.error;
      },
    });
    try {
      if (type === "quiz")
        await click(document.querySelectorAll(".run-options button")[1]);
      else
        for (const i of [0, 1]) {
          await click(document.querySelector(`[data-left="${i}"]`));
          await click(document.querySelector(`[data-right="${i}"]`));
        }
      const checked = await app.request("state");
      assert.equal(
        checked.sessions[id].attempts.length,
        1,
        "checking persists without Continue",
      );
      const aid = checked.sessions[id].attempts[0].id;
      await p.dispose();
      const reloaded = await show((await app.request("state")).sessions[id]);
      assert.equal(
        (await app.request("state")).sessions[id].attempts[0].id,
        aid,
      );
      await reloaded.dispose();
    } catch (e) {
      await p.dispose();
      throw e;
    }
  });
test("results retry selects the Review lane in both header and switcher", async () => {
  const p = await show({ analysis: single() }, { edgeId: "quick" });
  try {
    await click(document.querySelectorAll(".run-options button")[0]);
    await click(button(/^Continue/));
    await click(button(/^Review the 1 you missed/));
    assert.ok(button(/^Review misses$/));
    await click(document.querySelector('[aria-haspopup="dialog"]'));
    const lane = document.querySelector('[aria-label="Practice lane"]');
    assert.match(
      lane!.querySelector('[aria-selected="true"]')!.textContent!,
      /Review/,
    );
  } finally {
    await p.dispose();
  }
});
test("partial matching progress is disclosed before switching rounds", async () => {
  const p = await show({ analysis: single("matching") }, { edgeId: "quick" });
  try {
    await click(document.querySelector('[data-left="0"]'));
    await click(document.querySelector('[data-right="0"]'));
    await click(document.querySelector('[aria-haspopup="dialog"]'));
    assert.match(
      document.querySelector('[role="dialog"]')!.textContent!,
      /unchecked matching progress.*won.t be kept/i,
    );
  } finally {
    await p.dispose();
  }
});
test("a solid topic without harder questions asks Go instead of claiming readiness", async () => {
  let prompt = "";
  const p = await show(
    {
      analysis: single(),
      attempts: [
        {
          id: "a",
          studyId: "q1",
          analysisVersion: 1,
          response: "",
          rating: "understood",
          timestamp: new Date().toISOString(),
        },
      ],
    },
    {
      onGenerate: (v: string) => {
        prompt = v;
      },
    },
  );
  try {
    assert.doesNotMatch(
      document.querySelector('nav[aria-label="Practice topics"]')!.textContent!,
      /Ready for harder/,
    );
    assert.match(
      document.body.textContent!,
      /Basics solid.*ask Go for harder/i,
    );
    await click(button(/^Ask Go for the missing questions/));
    assert.match(prompt, /GPU: harder/);
  } finally {
    await p.dispose();
  }
});
test("local-only stale attempts have a nonblocking explanation", async () => {
  const p = await show({
    attempts: [
      {
        id: "a",
        studyId: "q1",
        analysisVersion: 1,
        response: "",
        rating: "understood",
        timestamp: new Date().toISOString(),
        localOnly: true,
      } as Attempt,
    ],
  });
  try {
    assert.match(
      document.body.textContent!,
      /1 answer was checked against an older version and kept on this device/,
    );
  } finally {
    await p.dispose();
  }
});
test("one checked answer is singular and guessed correct ideas are not Got brighter", async () => {
  const p = await show(
    { analysis: single() },
    { edgeId: "quick", preferences: { confidence: true } },
  );
  try {
    await click(button(/^Guessing$/));
    await click(document.querySelectorAll(".run-options button")[1]);
    assert.match(
      document.querySelector(".round-progress")!.textContent!,
      /1 answer saved/,
    );
    await click(document.querySelector('[aria-haspopup="dialog"]'));
    assert.match(
      document.querySelector('[role="dialog"]')!.textContent!,
      /1 checked answer is saved/,
    );
    await click(button(/^Continue/));
    const brighter = [
      ...document.querySelectorAll(".result-columns section"),
    ].find((s) => /Got brighter/.test(s.textContent!));
    assert.doesNotMatch(brighter!.textContent!, /GPU/);
    const fragile = [
      ...document.querySelectorAll(".result-columns section"),
    ].find((s) => /Right, not strong yet/.test(s.textContent!));
    assert.match(fragile!.textContent!, /GPU/);
  } finally {
    await p.dispose();
  }
});

for (const advance of ["Continue", "Enter", "End"] as const)
  test(`${advance} advances a checked item without recording it twice`, async () => {
    const saved: Attempt[] = [];
    const p = await show(
      { analysis: single() },
      {
        edgeId: "quick",
        onReview: async (a: Attempt) => {
          saved.push(a);
          return true;
        },
      },
    );
    try {
      await click(document.querySelectorAll(".run-options button")[1]);
      assert.equal(saved.length, 1);
      if (advance === "Enter")
        await act(async () =>
          document.body.dispatchEvent(
            new dom.window.KeyboardEvent("keydown", {
              key: "Enter",
              bubbles: true,
            }),
          ),
        );
      else
        await click(
          advance === "End"
            ? document.querySelector('[aria-label="End practice"]')
            : button(/^Continue/),
        );
      assert.match(document.body.textContent!, /Deep dig/);
      assert.equal(saved.length, 1);
    } finally {
      await p.dispose();
    }
  });

for (const type of ["quiz", "matching"] as const)
  test(`persisted ${type} updates the round counter while delivery is still pending`, async () => {
    let finish!: (ok: boolean) => void;
    const delivery = new Promise<boolean>((r) => {
      finish = r;
    });
    const root = createRoot(document.getElementById("root")!);
    const session = {
      id: "s1",
      version: 1,
      title: "Test",
      analysis: single(type),
      attempts: [],
      captures: [],
      processed: [],
      status: "paused",
      settings: {
        depth: "balanced",
        analogy: "everyday examples",
        activities: ["quiz", "matching"],
        articleCapture: true,
        autoHighlights: true,
      },
      createdAt: "2026-10-28T00:00:00Z",
      updatedAt: "2026-10-28T00:00:00Z",
    } as Session;
    const props = {
      edgeId: "quick",
      onReview: async (attempt: Attempt) => {
        session.attempts.push(attempt);
        // Model the storage.onChanged render after durable storage, before network reply.
        render();
        return delivery;
      },
      onFeedback() {},
      onToast() {},
    };
    const render = () =>
      root.render(
        React.createElement(Practice, { session: { ...session }, ...props }),
      );
    try {
      await act(async () => render());
      if (type === "quiz")
        await click(document.querySelectorAll(".run-options button")[1]);
      else
        for (const i of [0, 1]) {
          await click(document.querySelector(`[data-left="${i}"]`));
          await click(document.querySelector(`[data-right="${i}"]`));
        }
      assert.equal(session.attempts.length, 1);
      assert.match(
        document.querySelector(".round-progress")!.textContent!,
        /1 answer saved/,
      );
      assert.ok(
        document.querySelector(".feedback-sheet"),
        "Continue has not advanced the checked question",
      );
    } finally {
      await act(async () => {
        finish(true);
        await delivery;
      });
      await act(async () => root.unmount());
    }
  });

test("Practice singular counts cover one harder topic, question and minute", async () => {
  const a = single();
  a.concepts.push({ ...a.concepts[0], id: "empty", label: "Empty" });
  a.studyItems.push({ ...a.studyItems[0], id: "hard", level: "apply" });
  const p = await show({ analysis: a });
  try {
    assert.match(
      document.body.textContent!,
      /Harder questions exist for 1 topic\./,
    );
    assert.doesNotMatch(document.body.textContent!, /1 topics|1 minutes/);
  } finally {
    await p.dispose();
  }
  const one = await show({ analysis: single() });
  try {
    assert.match(
      document.body.textContent!,
      /1 saved question across 1 of 1 topic/,
    );
    assert.ok(button(/^Start 1 new question /));
    assert.match(document.body.textContent!, /About 1 minute ·/);
  } finally {
    await one.dispose();
  }
});
