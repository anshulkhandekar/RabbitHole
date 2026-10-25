import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { JSDOM } from "jsdom";

const bundle = await build({
  entryPoints: ["apps/extension/src/content.ts"],
  bundle: true,
  write: false,
  loader: { ".css": "text" },
  define: { __RABBIT_TOKENS__: '""' },
});
for (const failure of ["throw", "reject", "missing-id"] as const) {
  test(`content script retires after extension invalidation (${failure})`, async () => {
    const dom = new JSDOM("<p>Research article</p>", {
      url: "https://research.example/article",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    });
    const win = dom.window;
    const timeouts = new Map<number, () => void>();
    const intervals = new Map<number, () => void>();
    let sequence = 0,
      invalid = false,
      calls = 0;
    const listeners = new Set<unknown>();
    const runtime = {
      get id() {
        return invalid && failure === "missing-id"
          ? undefined
          : "test-extension";
      },
      getURL: (path: string) => `chrome-extension://test-extension/${path}`,
      sendMessage: () => {
        calls++;
        if (invalid) {
          const error = new Error("Extension context invalidated.");
          if (failure === "reject") return Promise.reject(error);
          throw error;
        }
        return Promise.resolve({
          id: "session",
          status: "active",
          readingMode: true,
          excluded: [],
          settings: { articleCapture: false, autoHighlights: true },
        });
      },
      onMessage: {
        addListener: (listener: unknown) => listeners.add(listener),
        removeListener: (listener: unknown) => listeners.delete(listener),
      },
    };
    Object.assign(win, {
      chrome: { runtime },
      setTimeout: (fn: () => void) => {
        const id = ++sequence;
        timeouts.set(id, fn);
        return id;
      },
      clearTimeout: (id: number) => timeouts.delete(id),
      setInterval: (fn: () => void) => {
        const id = ++sequence;
        intervals.set(id, fn);
        return id;
      },
      clearInterval: (id: number) => intervals.delete(id),
    });
    try {
      win.eval(bundle.outputFiles[0].text);
      for (const [id, callback] of [...timeouts]) {
        timeouts.delete(id);
        callback();
      }
      await new Promise((resolve) => setImmediate(resolve));
      const host = win.document.querySelector("[data-rabbithole-reading]")!;
      assert.ok(host, "active capture indicator appears");
      invalid = true;
      const pause = host.shadowRoot!.querySelector(
        ".pause",
      ) as HTMLButtonElement;
      await assert.doesNotReject(async () => {
        await pause.onclick!.call(pause, new win.MouseEvent("click") as any);
      });
      assert.equal(
        win.document.querySelector("[data-rabbithole-reading]"),
        null,
        "disconnected scripts must not claim to be collecting",
      );
      assert.equal(intervals.size, 0);
      assert.equal(timeouts.size, 0);
      assert.equal(listeners.size, 0);
      const retiredCalls = calls;
      win.dispatchEvent(new win.Event("popstate"));
      win.dispatchEvent(new win.Event("rabbithole-refresh"));
      win.document.dispatchEvent(new win.Event("visibilitychange"));
      assert.equal(
        timeouts.size,
        0,
        "retired event listeners cannot schedule work",
      );
      assert.equal(calls, retiredCalls);
    } finally {
      win.close();
    }
  });
}
