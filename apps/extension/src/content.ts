import { Readability } from "@mozilla/readability";
import { googleQuery, overview } from "./google";
import { readSelection } from "./selection";
import readingCSS from "./styles/reading.css";
declare const __RABBIT_TOKENS__: string;
(() => {
  const key = "__rabbitHoleInstalled";
  if ((globalThis as any)[key]) {
    (globalThis as any)[key]();
    return;
  }
  (globalThis as any)[key] = () => schedule();
  let stopped = false;
  const events = new AbortController();
  function stop() {
    if (stopped) return;
    stopped = true;
    context = null;
    clearTimeout(timer);
    clearTimeout(selectionTimer);
    clearTimeout(noteTimer);
    clearInterval(poll);
    observer.disconnect();
    events.abort();
    indicator?.remove();
    indicator = undefined;
    try {
      chrome.runtime.onMessage.removeListener(onMessage);
    } catch {
      // Chrome may have already removed the invalidated runtime.
    }
  }
  async function message(payload: object): Promise<any> {
    if (stopped) return null;
    try {
      if (!chrome.runtime.id) {
        stop();
        return null;
      }
      const result = await chrome.runtime.sendMessage(payload);
      return stopped ? null : result;
    } catch (error) {
      if (
        !chrome.runtime?.id ||
        /extension context invalidated/i.test(String(error))
      )
        stop();
      // Transient messaging failures can be retried on the next scan.
      return null;
    }
  }
  let context: any = null,
    lastUrl = "",
    lastArticle = "",
    timer: ReturnType<typeof setTimeout> | undefined;
  const send = async (
    type: string,
    text: string,
    references: string[] = [],
    tag = "none",
    automatic = false,
  ) => {
    if (
      !context ||
      context.included === false ||
      context.status !== "active" ||
      context.excluded.includes(location.href) ||
      !text.trim()
    )
      return;
    const result = await message({
      type: "capture",
      automatic,
      capture: {
        id: crypto.randomUUID(),
        sessionId: context.id,
        sourceType: type,
        url: location.href,
        title: document.title.slice(0, 300),
        text: text.trim().slice(0, 12000),
        timestamp: new Date().toISOString(),
        tag,
        references,
      },
    });
    if (result?.saved && indicator) {
      const dot = indicator.shadowRoot!.querySelector(".status")!;
      dot.classList.remove("saved");
      void (dot as HTMLElement).offsetWidth;
      dot.classList.add("saved");
      showReadingNote(
        type === "highlight"
          ? "Highlight saved"
          : type === "search"
            ? "Search saved"
            : "Page saved",
      );
    }
    return result;
  };
  function safeClone() {
    const clone = document.cloneNode(true) as Document;
    clone
      .querySelectorAll(
        'input,textarea,select,[contenteditable],script,style,nav,footer,header,aside,form,[hidden],[role="navigation"],[aria-hidden="true"],[data-rabbithole-reading]',
      )
      .forEach((el) => el.remove());
    return clone;
  }
  async function scan() {
    if (stopped) return;
    context = await message({ type: "reading-context" });
    if (stopped) return;
    updateIndicator();
    if (
      !context ||
      context.included === false ||
      context.status !== "active" ||
      document.visibilityState !== "visible"
    )
      return;
    if (lastUrl !== location.href) {
      lastUrl = location.href;
      lastArticle = "";
    }
    const q = googleQuery(location.href);
    if (q) {
      await send("search", q);
      const ai = overview(document);
      if (ai) await send("google_ai_overview", ai.text, ai.references);
    } else if (
      context.settings.articleCapture &&
      lastArticle !== location.href
    ) {
      const article = new Readability(safeClone(), {
        charThreshold: 250,
      }).parse();
      if (article?.textContent && article.textContent.trim().length >= 250) {
        lastArticle = location.href;
        await send("article", article.textContent);
      }
    }
  }
  const schedule = () => {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(() => void scan(), 1100);
  };
  // The observer only schedules extraction on Google; it never serializes a DOM.
  const observer = new MutationObserver(() => {
    if (googleQuery(location.href)) schedule();
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
  });
  document.addEventListener("visibilitychange", schedule, {
    signal: events.signal,
  });
  window.addEventListener("popstate", schedule, { signal: events.signal });
  window.addEventListener("rabbithole-refresh", schedule, {
    signal: events.signal,
  });
  // A low-frequency URL check handles History API navigation and session pause/resume.
  const poll = setInterval(() => {
    if (document.visibilityState === "visible") schedule();
  }, 6000);
  const onMessage: Parameters<
    typeof chrome.runtime.onMessage.addListener
  >[0] = (msg, _sender, reply) => {
    if (stopped) return;
    if (msg.type === "reading-update") {
      schedule();
      return;
    }
    if (msg.type !== "highlight") return;
    void (async () => {
      context = await message({ type: "reading-context" });
      const selected = readSelection(document, 1);
      if (!selected) return { ignored: true };
      if (!context || context.status !== "active")
        return { error: "Start or resume an included session first" };
      const result = await send(
        "highlight",
        selected,
        [],
        msg.tag ?? "important",
      );
      return result ?? { ignored: true };
    })()
      .then((result) => {
        if (!stopped) reply(result);
      })
      .catch(() => {
        // A response channel can close when the extension reloads.
      });
    return true;
  };
  chrome.runtime.onMessage.addListener(onMessage);
  let widgetDrag:
      | { pointerId: number; x: number; y: number; left: number; top: number }
      | undefined,
    movedWidget = false;
  function positionWidget(x: number, y: number) {
    if (!indicator) return;
    const left = 8 + Math.max(0, Math.min(1, x)) * Math.max(0, innerWidth - 60),
      top = 8 + Math.max(0, Math.min(1, y)) * Math.max(0, innerHeight - 56);
    indicator.style.left = `${left}px`;
    indicator.style.top = `${top}px`;
    indicator.style.right = "auto";
    indicator.dataset.edge = left < innerWidth / 2 ? "left" : "right";
  }
  window.addEventListener(
    "pointermove",
    (event) => {
      if (!widgetDrag || event.pointerId !== widgetDrag.pointerId || !indicator)
        return;
      const dx = event.clientX - widgetDrag.x,
        dy = event.clientY - widgetDrag.y;
      if (!movedWidget && Math.hypot(dx, dy) < 5) return;
      movedWidget = true;
      positionWidget(
        (widgetDrag.left + dx - 8) / Math.max(1, innerWidth - 60),
        (widgetDrag.top + dy - 8) / Math.max(1, innerHeight - 56),
      );
      event.preventDefault();
    },
    { signal: events.signal },
  );
  const endWidgetDrag = () => {
    if (widgetDrag && movedWidget && indicator) {
      const position = {
        x:
          (parseFloat(indicator.style.left) - 8) / Math.max(1, innerWidth - 60),
        y:
          (parseFloat(indicator.style.top) - 8) / Math.max(1, innerHeight - 56),
      };
      context.widgetPosition = position;
      void message({ type: "reading-position", position });
    }
    widgetDrag = undefined;
  };
  window.addEventListener("pointerup", endWidgetDrag, {
    signal: events.signal,
  });
  window.addEventListener("pointercancel", endWidgetDrag, {
    signal: events.signal,
  });
  window.addEventListener(
    "resize",
    () => {
      if (context?.widgetPosition)
        positionWidget(context.widgetPosition.x, context.widgetPosition.y);
    },
    { signal: events.signal },
  );
  let indicator: HTMLElement | undefined,
    noteTimer: ReturnType<typeof setTimeout> | undefined,
    selectionTimer: ReturnType<typeof setTimeout> | undefined,
    dragging = false;
  let intendedSelection: string | undefined;
  function updateIndicator() {
    if (
      stopped ||
      !context?.readingMode ||
      context.excluded.includes(location.href)
    ) {
      indicator?.remove();
      indicator = undefined;
      return;
    }
    if (!indicator) {
      indicator = document.createElement("div");
      indicator.dataset.rabbitholeReading = "true";
      if (context.theme === "light" || context.theme === "dark")
        indicator.dataset.theme = context.theme;
      const shadow = indicator.attachShadow({ mode: "open" }),
        style = document.createElement("style");
      style.textContent =
        __RABBIT_TOKENS__
          .replaceAll(
            ':root:not([data-theme="light"])',
            ':host(:not([data-theme="light"]))',
          )
          .replaceAll(':root[data-theme="dark"]', ':host([data-theme="dark"])')
          .replaceAll(":root", ":host") + readingCSS;
      shadow.append(style);
      const widget = document.createElement("div");
      widget.className = "reading-widget";
      const open = document.createElement("button");
      open.className = "rabbit";
      open.title = "Open RabbitHole";
      open.setAttribute("aria-label", "Open RabbitHole");
      const image = document.createElement("img");
      try {
        image.src = chrome.runtime.getURL("rabbithole-mark.svg");
      } catch {
        stop();
        return;
      }
      image.alt = "";
      open.append(image);
      const status = document.createElement("span");
      status.className = "status";
      open.append(status);
      status.addEventListener("animationend", (event) => {
        if (event.animationName === "capture-saved")
          status.classList.remove("saved");
      });
      open.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const rect = indicator!.getBoundingClientRect();
        movedWidget = false;
        widgetDrag = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          left: rect.left,
          top: rect.top,
        };
        open.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      });
      open.onclick = () =>
        movedWidget
          ? (movedWidget = false)
          : void message({ type: "reading-open" }).then((result) => {
              if (result?.error) showReadingNote(result.error);
            });
      const pause = document.createElement("button");
      pause.className = "pause";
      pause.onclick = async () => {
        await message({
          type: "reading-control",
          control: context?.status === "active" ? "pause" : "resume",
        });
        await scan();
      };
      const hide = document.createElement("button");
      hide.className = "hide";
      hide.textContent = "Hide";
      hide.title = "Hide indicator; collection keeps its current state";
      hide.onclick = async () => {
        await message({
          type: "reading-control",
          control: "hide",
        });
        await scan();
      };
      widget.append(open, pause, hide);
      shadow.append(widget);
      document.documentElement.append(indicator);
      if (context.widgetPosition)
        positionWidget(context.widgetPosition.x, context.widgetPosition.y);
    }
    const active = context.status === "active",
      shadow = indicator.shadowRoot!;
    if (!widgetDrag && context.widgetPosition)
      positionWidget(context.widgetPosition.x, context.widgetPosition.y);
    shadow
      .querySelector(".status")!
      .classList.toggle("paused", !active || context.included === false);
    shadow
      .querySelector(".status")!
      .classList.toggle("waiting", context.handoff === "waiting");
    shadow
      .querySelector(".status")!
      .classList.toggle(
        "error",
        !!context.syncError || context.handoff === "stalled",
      );
    if (context.theme === "light" || context.theme === "dark")
      indicator.dataset.theme = context.theme;
    else delete indicator.dataset.theme;
    const pause = shadow.querySelector<HTMLButtonElement>(".pause")!;
    pause.textContent = active ? "Pause" : "Resume";
    pause.title = active ? "Pause collection" : "Resume collection";
    shadow
      .querySelector(".rabbit")!
      .setAttribute(
        "aria-label",
        `Open RabbitHole; ${context.syncError ? "sync needs attention" : context.handoff === "waiting" ? "waiting for Go’s saved summary" : context.handoff === "stalled" ? "check Go for a failed save or approval" : !active ? "paused" : context.included === false ? "this page is not being collected" : "collecting"}. Drag to move.`,
      );
  }
  function showReadingNote(message: string) {
    if (!indicator) return;
    const shadow = indicator.shadowRoot!;
    shadow.querySelector(".reading-note")?.remove();
    const note = document.createElement("div");
    note.className = "reading-note";
    note.setAttribute("role", "status");
    note.textContent = message;
    shadow.append(note);
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => note.remove(), 2200);
  }
  function scheduleSelection() {
    clearTimeout(selectionTimer);
    if (stopped || dragging) return;
    const selected = readSelection(document);
    if (!selected || selected !== intendedSelection) return;
    selectionTimer = setTimeout(async () => {
      context = await message({ type: "reading-context" });
      if (
        !context?.settings.autoHighlights ||
        context.status !== "active" ||
        document.visibilityState !== "visible" ||
        readSelection(document) !== selected
      )
        return;
      const result = await send("highlight", selected, [], "important", true);
      if (result?.saved) showReadingNote("Highlight saved");
    }, 750);
  }
  document.addEventListener("selectionchange", scheduleSelection, {
    signal: events.signal,
  });
  document.addEventListener(
    "pointerdown",
    (event) => {
      if (!event.isTrusted) return;
      intendedSelection = undefined;
      dragging = true;
      clearTimeout(selectionTimer);
    },
    { passive: true, signal: events.signal },
  );
  document.addEventListener(
    "pointerup",
    (event) => {
      if (!event.isTrusted) return;
      dragging = false;
      intendedSelection = (event.target as Element)?.closest?.(
        "[data-rabbithole-reading]",
      )
        ? undefined
        : readSelection(document);
      scheduleSelection();
    },
    { passive: true, signal: events.signal },
  );
  document.addEventListener(
    "pointercancel",
    () => {
      dragging = false;
      clearTimeout(selectionTimer);
    },
    { passive: true, signal: events.signal },
  );
  document.addEventListener(
    "keyup",
    (event) => {
      if (
        event.isTrusted &&
        ([
          "Shift",
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
        ].includes(event.key) ||
          ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a"))
      ) {
        intendedSelection = readSelection(document);
        scheduleSelection();
      }
    },
    { signal: events.signal },
  );
  schedule();
})();
