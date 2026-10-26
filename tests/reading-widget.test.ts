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
async function page() {
  const dom = new JSDOM(
    "<article><p>" +
      "Research article with enough source text to extract. ".repeat(20) +
      "</p></article>",
    {
      url: "https://research.example/article",
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  );
  const win = dom.window;
  const timers = new Map<number, () => void>();
  const listeners: Function[] = [],
    messages: any[] = [];
  let seq = 0;
  let captured = false;
  const context: any = {
    id: "s1",
    status: "active",
    included: true,
    readingMode: true,
    excluded: [],
    settings: { articleCapture: false, autoHighlights: false },
  };
  Object.assign(win, {
    chrome: {
      runtime: {
        id: "test-extension",
        getURL: (p: string) => "chrome-extension://test-extension/" + p,
        onMessage: {
          addListener: (fn: Function) => listeners.push(fn),
          removeListener() {},
        },
        async sendMessage(m: any) {
          messages.push(m);
          if (m.type === "capture") {
            if (captured) return { duplicate: true };
            captured = true;
          }
          return m.type === "reading-context"
            ? structuredClone(context)
            : { saved: true };
        },
      },
    },
    setTimeout: (fn: () => void) => {
      const id = ++seq;
      timers.set(id, fn);
      return id;
    },
    clearTimeout: (id: number) => timers.delete(id),
    setInterval: () => 0,
    clearInterval() {},
  });
  const tick = async () => {
    for (const [id, fn] of [...timers]) {
      timers.delete(id);
      fn();
    }
    await new Promise((r) => setImmediate(r));
  };
  win.eval(bundle.outputFiles[0].text);
  await tick();
  const host = () =>
    win.document.querySelector<HTMLElement>("[data-rabbithole-reading]")!;
  const update = async () => {
    listeners.forEach((fn) => fn({ type: "reading-update" }));
    await tick();
  };
  const dispose = async () => {
    (win as any).chrome.runtime.id = "";
    await update();
    dom.window.close();
  };
  return {
    dom,
    win,
    tick,
    context,
    messages,
    host,
    update,
    listeners,
    dispose,
  };
}

test("reading widget follows shared waiting and sync error state without collecting an unrelated page", async () => {
  const p = await page();
  try {
    p.context.included = false;
    p.context.settings.articleCapture = true;
    p.context.handoff = "waiting";
    await p.update();
    assert.ok(p.host().shadowRoot!.querySelector(".status.waiting"));
    assert.match(
      p
        .host()
        .shadowRoot!.querySelector(".rabbit")!
        .getAttribute("aria-label")!,
      /waiting/i,
    );
    p.context.syncError = true;
    await p.update();
    assert.ok(p.host().shadowRoot!.querySelector(".status.error"));
    assert.equal(p.messages.filter((m) => m.type === "capture").length, 0);
  } finally {
    await p.dispose();
  }
});

test("dragging the rabbit clamps its position, persists it and does not open the panel", async () => {
  const p = await page();
  try {
    const host = p.host(),
      rabbit = host.shadowRoot!.querySelector<HTMLElement>(".rabbit")!;
    host.getBoundingClientRect = () =>
      ({ left: 900, top: 16, width: 44, height: 40 }) as DOMRect;
    const pointer = (type: string, x: number, y: number) => {
      const e = new p.win.MouseEvent(type, {
        bubbles: true,
        clientX: x,
        clientY: y,
        button: 0,
      });
      Object.defineProperty(e, "pointerId", { value: 1 });
      return e;
    };
    rabbit.dispatchEvent(pointer("pointerdown", 920, 30));
    p.win.dispatchEvent(pointer("pointermove", -200, 2000));
    p.win.dispatchEvent(pointer("pointerup", -200, 2000));
    rabbit.click();
    await new Promise((r) => setImmediate(r));
    assert.equal(host.style.left, "8px");
    assert.ok(parseFloat(host.style.top) <= p.win.innerHeight - 48);
    const saved = p.messages.find((m) => m.type === "reading-position");
    assert.ok(saved);
    assert.equal(saved.position.x, 0);
    assert.ok(saved.position.y <= 1);
    assert.equal(
      p.messages.some((m) => m.type === "reading-open"),
      false,
    );
  } finally {
    await p.dispose();
  }
});

test("a saved highlight gives immediate feedback but duplicates do not reflash", async () => {
  const p = await page();
  try {
    const text = p.win.document.querySelector("p")!.firstChild!;
    const range = p.win.document.createRange();
    range.selectNodeContents(text);
    p.win.getSelection()!.addRange(range);
    await new Promise<void>((resolve) =>
      p.listeners[0]({ type: "highlight" }, {}, () => resolve()),
    );
    assert.ok(p.host().shadowRoot!.querySelector(".status.saved"));
    p.host().shadowRoot!.querySelector(".status")!.classList.remove("saved");
    await new Promise<void>((resolve) =>
      p.listeners[0]({ type: "highlight" }, {}, () => resolve()),
    );
    assert.equal(p.host().shadowRoot!.querySelector(".status.saved"), null);
  } finally {
    await p.dispose();
  }
});
