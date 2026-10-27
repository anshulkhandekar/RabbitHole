import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { analysis, capture } from "./support";
import type { Session, Attempt } from "../packages/contracts/src/index";
import {
  deriveFlags,
  deriveMemory,
  quickQueue,
  retryItems,
} from "../apps/extension/src/practice-model";
import {
  isExcluded,
  looksUnrelated,
  siteKey,
} from "../apps/extension/src/exclusion";
import {
  toAnkiCsv,
  toMarkdown,
  toQuizlet,
} from "../apps/extension/src/export-model";
function session(extra: Partial<Session> = {}): Session {
  const a = analysis() as any;
  a.concepts[1] = {
    ...a.concepts[1],
    claim: "Parallel execution runs many operations at the same moment.",
    why: "One fast core still finishes pixels one after another.",
    steps: ["Split the work into pieces.", "Run the pieces together."],
    example: "Shading 2 million pixels at once instead of in a queue.",
    boundary: "Work with strict ordering gains little.",
    takeaways: ["Throughput, not speed per task."],
    buildsOn: ["n1"],
    gap: "The sources never say how memory keeps up.",
    nextSearch: "GPU memory bandwidth explained",
    evidence: [{ captureId: "c1", quote: "process many operations at once" }],
  };
  a.studyItems[0] = {
    ...a.studyItems[0],
    choiceExplanations: [
      "This reflects the belief that GPUs work like a faster CPU.",
      "Right: the source describes many operations at once.",
    ],
    hints: ["Look at what happens to many operations.", "Think in batches."],
  };
  return {
    id: "s1",
    version: 1,
    title: "GPUs",
    goal: "Why are GPUs fast at graphics?",
    analysis: a,
    attempts: [],
    captures: [capture()],
    processed: ["c1"],
    status: "paused",
    settings: { analogy: "everyday examples" },
    createdAt: "2026-10-25T00:00:00Z",
    updatedAt: "2026-10-25T00:00:00Z",
    ...extra,
  } as unknown as Session;
}
function dom() {
  const d = new JSDOM('<div id="root"></div>', { url: "http://localhost" });
  Object.assign(globalThis, {
    window: d.window,
    document: d.window.document,
    HTMLElement: d.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  d.window.HTMLElement.prototype.scrollTo = () => {};
  const click = async (el: Element) =>
    act(async () =>
      el.dispatchEvent(new d.window.MouseEvent("click", { bubbles: true })),
    );
  return { d, click, root: createRoot(document.getElementById("root")!) };
}
const attempt = (studyId: string, extra: Partial<Attempt>): Attempt => ({
  id: crypto.randomUUID(),
  studyId,
  analysisVersion: 1,
  response: "",
  rating: "understood",
  timestamp: new Date().toISOString(),
  ...extra,
});

test("the idea drawer shows claim, why, steps, example, boundary, prior ideas and a next search", async () => {
  const { IdeaDrawer } = await import("../apps/extension/src/IdeaDrawer");
  const { d, root, click } = dom(),
    explained: string[] = [];
  let selected: any = { kind: "concept", id: "n2" };
  const render = () =>
    root.render(
      React.createElement(IdeaDrawer, {
        session: session(),
        selected,
        onSelect: (s: any) => (selected = s),
        onPractice: () => {},
        onWalk: () => {},
        onExplain: (id: string, style: string) =>
          explained.push(`${id}:${style}`),
      }),
    );
  await act(async () => render());
  const text = document.body.textContent!;
  for (const part of [
    "Parallel execution runs many operations at the same moment.",
    "Why this exists",
    "Split the work into pieces.",
    "Shading 2 million pixels",
    "Where it stops applying",
    "Throughput, not speed per task.",
    "Builds on",
    "Search: GPU memory bandwidth explained",
  ])
    assert.ok(text.includes(part), `missing ${part}`);
  assert.equal(document.querySelectorAll(".idea-steps li").length, 2);
  assert.match(
    document.querySelector<HTMLAnchorElement>(".search-chip")!.href,
    /google\.com\/search\?q=GPU%20memory%20bandwidth%20explained/,
  );
  await click(
    [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("explain it differently"),
    )!,
  );
  await click(
    [...document.querySelectorAll("button")].find(
      (b) => b.textContent === "Simpler",
    )!,
  );
  assert.deepEqual(explained, ["n2:simpler"]);
  await act(async () => root.unmount());
  d.window.close();
});

test("an idea whose sources were all hidden says so instead of showing them", async () => {
  const { IdeaDrawer } = await import("../apps/extension/src/IdeaDrawer");
  const { d, root } = dom();
  await act(async () =>
    root.render(
      React.createElement(IdeaDrawer, {
        session: session({ hidden: ["c1"] }),
        selected: { kind: "concept", id: "n2" },
        onSelect: () => {},
        onPractice: () => {},
        onWalk: () => {},
      }),
    ),
  );
  assert.match(document.body.textContent!, /Sources removed/);
  assert.equal(document.querySelectorAll(".source-quote").length, 0);
  await act(async () => root.unmount());
  d.window.close();
});

test("practice evidence never renders the text of a hidden source", async () => {
  const { Evidence } = await import("../apps/extension/src/Trail");
  const { d, root } = dom();
  await act(async () =>
    root.render(
      React.createElement(Evidence, {
        session: session({ hidden: ["c1"] }),
        ids: ["c1"],
        excerpts: [
          { captureId: "c1", quote: "process many operations at once" },
        ],
      }),
    ),
  );
  assert.equal(document.querySelectorAll(".source-quote").length, 0);
  assert.equal(
    document.body.textContent!.includes("process many operations at once"),
    false,
  );
  await act(async () => root.unmount());
  d.window.close();
});

test("a sure wrong answer is flagged, explains the picked option and saves confidence and hints", async () => {
  const { Practice } = await import("../apps/extension/src/Practice");
  const { d, root, click } = dom(),
    saved: Attempt[] = [];
  await act(async () =>
    root.render(
      React.createElement(Practice, {
        session: session(),
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
  assert.match(document.body.textContent!, /How sure are you\?/);
  await click(
    [...document.querySelectorAll(".confidence-row button")].find(
      (b) => b.textContent === "Sure",
    )!,
  );
  await click(
    [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("show a hint"),
    )!,
  );
  assert.match(document.body.textContent!, /Hint 1/);
  await click(document.querySelectorAll(".run-options button")[0]);
  const text = document.body.textContent!;
  assert.match(text, /Confident miss/);
  assert.match(text, /GPUs work like a faster CPU/);
  assert.match(text, /source describes many operations at once/);
  assert.ok(document.querySelector(".miss-note textarea"));
  await click(
    [...document.querySelectorAll(".feedback-sheet button")].find((b) =>
      b.textContent?.startsWith("Continue"),
    )!,
  );
  assert.equal(saved[0].confidence, "sure");
  assert.equal(saved[0].hintsUsed, 1);
  assert.equal(saved[0].rating, "again");
  await act(async () => root.unmount());
  d.window.close();
});

test("guesses and hints don't count as strong; sure misses become misconceptions and lead the queue", () => {
  const a = session().analysis!;
  const guessed = [attempt("q1", { choice: 1, confidence: "guess" })];
  assert.equal(deriveMemory(a, guessed).n2, "shaky");
  assert.equal(deriveFlags(a, guessed).n2, "fragile");
  const hinted = [attempt("q1", { choice: 1, hintsUsed: 2 })];
  assert.equal(deriveFlags(a, hinted).n1, "fragile");
  const sure = [attempt("q1", { choice: 1, confidence: "sure" })];
  assert.equal(deriveMemory(a, sure).n2, "strong");
  assert.equal(deriveFlags(a, sure).n2, undefined);
  const missed = [
    attempt("f1", { rating: "understood" }),
    attempt("q1", { choice: 0, rating: "again", confidence: "sure" }),
  ];
  const flags = deriveFlags(a, missed);
  assert.equal(flags.n2, "misconception");
  assert.equal(
    quickQueue(a.studyItems, deriveMemory(a, missed), flags)[0].id,
    "q1",
  );
  // A later confident right answer clears the flag.
  assert.equal(
    deriveFlags(a, [
      ...missed,
      attempt("q1", { choice: 1, confidence: "think" }),
    ]).n2,
    undefined,
  );
});

test("retries use a sibling question, and siblings stay out of first runs", () => {
  const items = session().analysis!.studyItems;
  const sibling = {
    ...items[0],
    id: "q1b",
    variantOf: "q1",
    prompt: "New case",
  };
  const all = [...items, sibling];
  assert.deepEqual(
    retryItems(all, [items[0]]).map((i) => i.id),
    ["q1b"],
  );
  assert.deepEqual(
    retryItems(all, [sibling]).map((i) => i.id),
    ["q1"],
  );
  assert.ok(!quickQueue(all, {}).some((i) => i.id === "q1b"));
});

test("exports keep their sources: Anki CSV quoting, Quizlet tabs and Markdown links", () => {
  const s = session();
  s.analysis!.studyItems.push({
    id: "m1",
    type: "matching",
    prompt: "Match",
    answer: "Pairs",
    pairs: [
      { left: "GPU", right: 'A "parallel" processor' },
      { left: "CPU", right: "Few fast cores" },
    ],
    conceptIds: ["n1"],
    captureIds: ["c1"],
  } as any);
  const anki = toAnkiCsv(s).split("\n");
  assert.equal(anki[2], "#columns:Front,Back,Source,Tags");
  assert.ok(anki.some((l) => l.includes('A ""parallel"" processor')));
  assert.ok(anki.some((l) => l.includes("https://example.org/gpu")));
  assert.ok(anki.some((l) => l.includes("rabbithole gpus quiz")));
  const quizlet = toQuizlet(s).split("\n");
  assert.ok(quizlet.every((l) => l.split("\t").length === 2));
  assert.ok(
    quizlet.includes(
      "Parallel execution\tParallel execution runs many operations at the same moment.",
    ),
  );
  const md = toMarkdown(s);
  assert.match(md, /^---\ntitle: "GPUs"/);
  assert.match(md, /\*\*Question:\*\* Why are GPUs fast at graphics\?/);
  assert.ok(
    md.includes("- uses [[#Parallel execution|Parallel execution]]"),
    "Obsidian links must target the headings in this exported note",
  );
  assert.match(md, /> process many operations at once/);
  assert.match(md, /1\. Split the work into pieces\./);
  assert.equal(toAnkiCsv(session({ analysis: null })), "");
});

test("site exclusion and new-topic detection", () => {
  const list = [
    siteKey("https://www.reddit.com/r/x"),
    "https://a.example/page",
  ];
  assert.ok(isExcluded(list, "https://www.reddit.com/r/other"));
  assert.ok(isExcluded(list, "https://a.example/page"));
  assert.ok(!isExcluded(list, "https://a.example/other"));
  assert.ok(!isExcluded(undefined, "https://a.example/page"));
  const seen = ["how do gpus work", "what is cuda"];
  assert.ok(looksUnrelated("best pasta recipes", seen));
  assert.ok(!looksUnrelated("gpu memory bandwidth", seen));
  assert.ok(!looksUnrelated("cuda kernels", seen));
  assert.ok(!looksUnrelated("how", seen));
  assert.ok(!looksUnrelated("pasta", []));
});

test("a Google search with no rabbit hole shows the start card without capturing", async () => {
  const bundle = await build({
    entryPoints: ["apps/extension/src/content.ts"],
    bundle: true,
    write: false,
    loader: { ".css": "text" },
    define: { __RABBIT_TOKENS__: '""' },
  });
  const page = new JSDOM("<main>results</main>", {
    url: "https://www.google.com/search?q=how+do+tides+work",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const win = page.window,
    messages: any[] = [],
    timers = new Map<number, () => void>();
  let seq = 0;
  const shadows: ShadowRoot[] = [];
  const attach = win.Element.prototype.attachShadow;
  win.Element.prototype.attachShadow = function (init) {
    const root = attach.call(this, { ...init, mode: "open" });
    shadows.push(root);
    return root;
  };
  Object.assign(win, {
    chrome: {
      runtime: {
        id: "test-extension",
        getURL: (p: string) => "chrome-extension://test-extension/" + p,
        onMessage: { addListener() {}, removeListener() {} },
        async sendMessage(m: any) {
          messages.push(m);
          if (m.type === "reading-context") return null;
          if (m.type === "search-offer")
            return { kind: "start", query: "how do tides work" };
          return { saved: true };
        },
      },
    },
    setTimeout: (fn: () => void) => {
      timers.set(++seq, fn);
      return seq;
    },
    clearTimeout: (id: number) => timers.delete(id),
    setInterval: () => 0,
    clearInterval() {},
  });
  win.eval(bundle.outputFiles[0].text);
  for (let i = 0; i < 3; i++) {
    for (const [id, fn] of [...timers]) {
      timers.delete(id);
      fn();
    }
    await new Promise((r) => setImmediate(r));
  }
  const card = shadows.map((s) => s.querySelector(".offer")).find(Boolean)!;
  assert.ok(card, "offer card rendered");
  assert.match(
    card.textContent!,
    /Start a rabbit hole for “how do tides work”\?/,
  );
  assert.ok(card.querySelector("input[placeholder^='What are you trying']"));
  assert.equal(card.querySelectorAll(".familiar button").length, 3);
  assert.equal(messages.filter((m) => m.type === "search-offer").length, 1);
  assert.equal(messages.filter((m) => m.type === "capture").length, 0);
  // Synthetic clicks from page scripts are ignored.
  card.querySelector<HTMLButtonElement>("button.primary")!.click();
  await new Promise((r) => setImmediate(r));
  assert.equal(messages.filter((m) => m.type === "search-accept").length, 0);
  // Invalidate the runtime so the script retires its observer before closing.
  (win as any).chrome.runtime.id = "";
  win.dispatchEvent(new win.Event("rabbithole-refresh"));
  for (const [id, fn] of [...timers]) {
    timers.delete(id);
    fn();
  }
  await new Promise((r) => setImmediate(r));
  assert.equal(shadows.filter((s) => s.host.isConnected).length, 0);
  page.window.close();
});
