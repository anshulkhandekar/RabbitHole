import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import { worker } from "./worker-harness";

const bundle = await build({
  entryPoints: ["apps/extension/src/content.ts"],
  bundle: true,
  write: false,
  loader: { ".css": "text" },
  define: { __RABBIT_TOKENS__: '""' },
});

test("highlight confirmation Undo removes the saved passage through the worker", async () => {
  const url = "https://research.example/article";
  const app = worker({ id: 7, url });
  const id = (await app.request("start")).active;
  await app.request("preferences", {
    shareSessionPreferences: true,
    newSessionDefaults: { articleCapture: false, autoHighlights: true },
  });
  const dom = new JSDOM("<p>A passage worth saving.</p>", {
    url,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const win = dom.window;
  const timers = new Map<number, () => void>();
  let sequence = 0;
  let listener: Function;
  Object.assign(win, {
    chrome: {
      runtime: {
        id: "test-extension",
        getURL: (path: string) => `chrome-extension://test-extension/${path}`,
        sendMessage: (msg: object) => app.fromTab(msg, url, 7),
        onMessage: {
          addListener: (fn: Function) => {
            listener = fn;
          },
          removeListener() {},
        },
      },
    },
    setTimeout: (fn: () => void) => {
      timers.set(++sequence, fn);
      return sequence;
    },
    clearTimeout: (key: number) => timers.delete(key),
    setInterval: () => 0,
    clearInterval() {},
  });
  try {
    win.eval(bundle.outputFiles[0].text);
    for (const [key, callback] of [...timers]) {
      timers.delete(key);
      callback();
    }
    await new Promise((resolve) => setImmediate(resolve));
    const range = win.document.createRange();
    range.selectNodeContents(win.document.querySelector("p")!);
    win.getSelection()!.addRange(range);
    const saved = await new Promise<any>((reply) =>
      listener({ type: "highlight" }, {}, reply),
    );
    assert.equal(saved.saved, true);
    const shadow = win.document.querySelector(
      "[data-rabbithole-reading]",
    )!.shadowRoot!;
    const undo = shadow.querySelector<HTMLButtonElement>(
      '[aria-label="Undo highlight save"]',
    );
    assert.ok(undo, "highlight confirmation must offer Undo");
    await undo.onclick!.call(undo, new win.MouseEvent("click") as any);
    assert.match(shadow.textContent!, /Highlight removed/);
    assert.equal(app.local.state.sessions[id].captures.length, 0);
    assert.ok(app.local.state.sessions[id].removed.includes(saved.captureId));
    assert.ok(
      app.local.state.queue.some(
        (q: any) =>
          q.method === "DELETE" && q.path.endsWith(`/${saved.captureId}`),
      ),
    );
  } finally {
    win.close();
  }
});
