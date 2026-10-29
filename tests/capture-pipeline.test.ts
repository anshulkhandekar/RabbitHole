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

test("stylesheet-hidden help and cookie banners are omitted before article parsing", () => {
  const dom = new JSDOM(
    `<style>#mdbook-help-container { display:none } .invisible { visibility:hidden }</style><main><h1>Rust</h1><p>${"Borrowing lets readers share data without copying it. ".repeat(15)}</p><div id="mdbook-help-container">Keyboard shortcuts help popup</div><p class="invisible">Invisible stylesheet text</p><div id="cookie-banner">Accept cookies or manage consent</div><div aria-label="Cookie consent">Consent preferences</div></main>`,
  );
  const text = pageText(dom.window.document);
  assert.match(text!, /Borrowing/);
  assert.doesNotMatch(
    text!,
    /shortcuts|Invisible|Accept cookies|Consent preferences/,
  );
  dom.window.close();
});

test("Google query is saved on load before the debounced content scan", async () => {
  const dom = new JSDOM("<main>Results</main>", {
    url: "https://www.google.com/search?q=fast+navigation",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const captures: any[] = [];
  Object.assign(dom.window, {
    chrome: {
      runtime: {
        id: "test",
        getURL: (p: string) => "chrome-extension://test/" + p,
        onMessage: { addListener() {}, removeListener() {} },
        sendMessage: async (m: any) => {
          if (m.type === "reading-context")
            return {
              id: "s1",
              included: true,
              status: "active",
              excluded: [],
              settings: {},
              readingMode: false,
            };
          if (m.type === "capture") {
            captures.push(m.capture);
            return { saved: true };
          }
          return {};
        },
      },
    },
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
  });
  try {
    dom.window.eval(bundle.outputFiles[0].text);
    await new Promise((r) => setImmediate(r));
    assert.equal(captures[0]?.sourceType, "search");
    assert.equal(captures[0]?.text, "fast navigation");
  } finally {
    dom.window.close();
  }
});

test("article titles and paragraphs have separators without duplicating a repeated H1", () => {
  const dom = new JSDOM(
    `<html><head><title>TCP congestion control</title></head><body><article><h1>TCP congestion control</h1><p>${"Independent operations proceed together when their inputs are ready. ".repeat(4)}</p><p>A second paragraph explains the boundary.</p></article></body></html>`,
  );
  try {
    const text = pageText(dom.window.document)!;
    assert.equal((text.match(/TCP congestion control/g) ?? []).length, 1);
    assert.match(text, /^TCP congestion control\s+Independent operations/);
    assert.match(text, /ready\.\s+A second paragraph/);
    assert.doesNotMatch(text, /controlTCP|controlIndependent|ready\.A second/);
  } finally {
    dom.window.close();
  }
});
