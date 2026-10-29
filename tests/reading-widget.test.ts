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
async function page(position?: { x: number; y: number }, smallControl = false) {
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
    ...(position && { widgetPosition: position }),
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
          if (m.type === "reading-include") context.included = true;
          if (m.type === "reading-undo") return { removed: true };
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
  const header = win.document.createElement("button");
  header.textContent = smallControl ? "Google Account" : "Share agent";
  header.style.cssText =
    "position:fixed;top:9px;right:10px;width:40px;height:40px";
  win.document.body.prepend(header);
  const controlRect = {
    left: win.innerWidth - 47,
    right: win.innerWidth - 7,
    top: 9,
    bottom: 49,
    width: 40,
    height: 40,
  } as DOMRect;
  header.getBoundingClientRect = () => controlRect;
  win.document.elementsFromPoint = (x, y) =>
    smallControl
      ? x >= controlRect.left &&
        x <= controlRect.right &&
        y >= controlRect.top &&
        y <= controlRect.bottom
        ? [header]
        : []
      : y < 100
        ? [header]
        : [];
  const rect = win.HTMLElement.prototype.getBoundingClientRect;
  win.HTMLElement.prototype.getBoundingClientRect = function () {
    if ((this as HTMLElement).dataset.rabbitholeReading) {
      const left = parseFloat((this as HTMLElement).style.left) || 0;
      const top = parseFloat((this as HTMLElement).style.top) || 0;
      return {
        left,
        top,
        right: left + (smallControl ? 49 : 44),
        bottom: top + (smallControl ? 42 : 40),
        width: smallControl ? 49 : 44,
        height: smallControl ? 42 : 40,
      } as DOMRect;
    }
    return rect.call(this);
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
    controlRect,
    dispose,
  };
}

test("resume offers inclusion beside the rabbit and scans immediately after acceptance", async () => {
  const p = await page();
  try {
    p.context.included = false;
    p.context.readingMode = false;
    p.context.settings.articleCapture = true;
    p.listeners.forEach((fn) =>
      fn({ type: "reading-update", promptInclude: true }),
    );
    await p.tick();
    const prompt = p.host()?.shadowRoot?.querySelector(".include-prompt");
    assert.ok(
      prompt,
      "resume shows a page-local prompt even with the indicator hidden",
    );
    assert.match(prompt.textContent!, /isn’t being saved/);
    assert.equal(p.messages.filter((m) => m.type === "capture").length, 0);
    prompt.querySelector<HTMLButtonElement>("button")!.click();
    await p.tick();
    await p.tick();
    assert.equal(
      p.messages.filter((m) => m.type === "reading-include").length,
      1,
    );
    assert.equal(p.messages.filter((m) => m.type === "capture").length, 1);
    assert.equal(
      p.host(),
      null,
      "acceptance retains the user's hidden-indicator preference",
    );
  } finally {
    await p.dispose();
  }
});

test("the article saved notice offers a one-click Undo for that article", async () => {
  const p = await page();
  try {
    p.context.settings.articleCapture = true;
    await p.update();
    const saved = p.messages.find((m) => m.type === "capture");
    const undo = p
      .host()
      .shadowRoot!.querySelector<HTMLButtonElement>(".reading-note button");
    assert.ok(
      undo,
      "the saved notice exposes Undo without opening the sidebar",
    );
    assert.match(undo.getAttribute("aria-label")!, /undo/i);
    undo.click();
    await new Promise((r) => setImmediate(r));
    const request = p.messages.find((m) => m.type === "reading-undo");
    assert.equal(request.captureId, saved.capture.id);
    assert.equal(request.sessionId, "s1");
    assert.match(
      p.host().shadowRoot!.querySelector(".reading-note")!.textContent!,
      /Article removed/,
    );
  } finally {
    await p.dispose();
  }
});

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

test("resume inclusion can be dismissed and never follows a different session", async () => {
  const p = await page();
  try {
    p.context.included = false;
    p.context.readingMode = false;
    const offer = async () => {
      p.listeners.forEach((fn) =>
        fn({ type: "reading-update", promptInclude: true, sessionId: "s1" }),
      );
      await p.tick();
    };
    await offer();
    const buttons = p
      .host()
      .shadowRoot!.querySelectorAll<HTMLButtonElement>(
        ".include-prompt button",
      );
    buttons[1].click();
    assert.equal(p.host(), null);
    await p.update();
    assert.equal(p.host(), null, "dismissal survives the next scan");
    await offer();
    p.context.id = "s2";
    await p.update();
    assert.equal(
      p.host(),
      null,
      "a prompt belongs only to the resumed session",
    );
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

test("default bunny position avoids header controls", async () => {
  const p = await page();
  try {
    assert.ok(parseFloat(p.host().style.top) >= 100);
  } finally {
    await p.dispose();
  }
});
test("a saved overlapping bunny is nudged once per page without rewriting its saved preference", async () => {
  const p = await page({ x: 1, y: 0 });
  try {
    assert.ok(parseFloat(p.host().style.top) >= 100);
    const placed = p.host().style.top;
    assert.equal(
      p.messages.filter((m) => m.type === "reading-position").length,
      0,
    );
    await p.update();
    assert.equal(p.host().style.top, placed);
    assert.deepEqual(p.context.widgetPosition, { x: 1, y: 0 });
  } finally {
    await p.dispose();
  }
});

test("a small account button inside the bunny footprint is cleared without changing its saved position", async () => {
  const p = await page({ x: 1, y: 0 }, true);
  try {
    const clear = () => {
      const a = p.host().getBoundingClientRect(),
        b = p.controlRect;
      assert.ok(
        a.right <= b.left ||
          a.left >= b.right ||
          a.bottom <= b.top ||
          a.top >= b.bottom,
        "widget must not intersect the 40px header button",
      );
    };
    clear();
    const top = p.host().style.top;
    await p.update();
    clear();
    assert.equal(p.host().style.top, top);
    assert.deepEqual(p.context.widgetPosition, { x: 1, y: 0 });
    assert.equal(
      p.messages.filter((m) => m.type === "reading-position").length,
      0,
    );
  } finally {
    await p.dispose();
  }
});
