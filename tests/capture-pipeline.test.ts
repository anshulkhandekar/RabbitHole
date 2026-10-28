import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { build } from "esbuild";
import { pageText } from "../apps/extension/src/capture-model";
const bundle = await build({
  entryPoints: ["apps/extension/src/content.ts"],
  bundle: true,
  write: false,
  loader: { ".css": "text" },
  define: { __RABBIT_TOKENS__: '""' },
});
test("article extraction keeps readable main text while omitting forms and hidden text", () => {
  const text =
    "A magnesium alloy makes the enclosure lighter while maintaining useful rigidity. ".repeat(
      8,
    );
  const doc = new JSDOM(
    `<main><h1>Materials</h1><p>${text}</p><form><p>Do not collect this form text.</p><input value="private value"></form><p hidden>Do not collect hidden content.</p></main>`,
  ).window.document;
  const result = pageText(doc);
  assert.ok(result);
  assert.match(result, /magnesium alloy/);
  assert.doesNotMatch(result, /private value|form text|hidden content/);
});
test("a rejected article capture is retried rather than permanently marked captured", async () => {
  const dom = new JSDOM(
    "<main><h1>Research</h1><p>" +
      "Independent operations can proceed together when neither waits for the other's result. ".repeat(
        10,
      ) +
      "</p></main>",
    {
      url: "https://research.example/article",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  );
  const callbacks = new Map<number, Function>();
  let seq = 0,
    attempts = 0;
  const listeners: Function[] = [];
  Object.assign(dom.window, {
    chrome: {
      runtime: {
        id: "test",
        getURL: (p: string) => "chrome-extension://test/" + p,
        onMessage: {
          addListener: (fn: Function) => listeners.push(fn),
          removeListener() {},
        },
        sendMessage: async (m: any) =>
          m.type === "reading-context"
            ? {
                id: "s1",
                status: "active",
                included: true,
                readingMode: false,
                excluded: [],
                settings: { articleCapture: true, autoHighlights: true },
              }
            : m.type === "capture"
              ? ++attempts === 1
                ? { error: "Temporary failure" }
                : { saved: true }
              : {},
      },
    },
    setTimeout: (fn: Function) => {
      const id = ++seq;
      callbacks.set(id, fn);
      return id;
    },
    clearTimeout: (id: number) => callbacks.delete(id),
    setInterval: () => 0,
    clearInterval() {},
  });
  const tick = async () => {
    for (const [id, fn] of [...callbacks]) {
      callbacks.delete(id);
      fn();
    }
    await new Promise((r) => setImmediate(r));
  };
  try {
    dom.window.eval(bundle.outputFiles[0].text);
    await tick();
    assert.equal(attempts, 1);
    dom.window.dispatchEvent(new dom.window.Event("rabbithole-refresh"));
    await tick();
    assert.equal(attempts, 2);
    dom.window.dispatchEvent(new dom.window.Event("rabbithole-refresh"));
    await tick();
    assert.equal(attempts, 2);
    dom.window.document.querySelector("main")!.appendChild(
      Object.assign(dom.window.document.createElement("p"), {
        textContent: "Dynamically loaded explanatory article text. ".repeat(20),
      }),
    );
    await new Promise((r) => setImmediate(r));
    await tick();
    assert.equal(
      attempts,
      3,
      "Dynamic article text must be rescanned and saved",
    );
  } finally {
    dom.window.close();
  }
});
