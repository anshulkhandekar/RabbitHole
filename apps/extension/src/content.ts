import { pageText, articleChanged } from "./capture-model";
import { googleQuery, overview } from "./google";
import { readSelection } from "./selection";
import readingCSS from "./styles/reading.css";
import offerCSS from "./styles/offer.css";
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
    offerHost?.remove();
    offerHost = undefined;
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
    lastArticleText = "",
    scannedSession = "",
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
    const captureId = crypto.randomUUID(),
      sessionId = context.id;
    const result = await message({
      type: "capture",
      automatic,
      capture: {
        id: captureId,
        sessionId,
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
            : type === "google_ai_overview"
              ? "AI Overview saved"
              : "Article saved",
        type === "article"
          ? { captureId: result.captureId ?? captureId, sessionId }
          : undefined,
      );
    }
    return result;
  };
  let scanning = false;
  async function scan() {
    if (stopped || scanning) return;
    scanning = true;
    try {
      context = await message({ type: "reading-context" });
      if (stopped) return;
      updateIndicator();
      if (document.visibilityState !== "visible") return;
      if (lastUrl !== location.href || scannedSession !== context?.id) {
        lastUrl = location.href;
        scannedSession = context?.id ?? "";
        lastArticle = "";
        lastArticleText = "";
      }
      const q = googleQuery(location.href);
      if (q && lastOffer !== location.href) {
        lastOffer = location.href;
        const offer = await message({ type: "search-offer" });
        if (stopped) return;
        if (offer?.kind) showOffer(offer);
        else hideOffer();
      }
      if (
        !context ||
        context.included === false ||
        context.status !== "active" ||
        document.visibilityState !== "visible"
      )
        return;
      if (q) {
        await send("search", q);
        const ai = overview(document);
        if (ai) await send("google_ai_overview", ai.text, ai.references);
      } else if (context.settings.articleCapture) {
        const text = pageText(document);
        if (
          text &&
          (lastArticle !== location.href ||
            articleChanged(lastArticleText, text))
        ) {
          const result = await send("article", text);
          if (result?.saved || result?.duplicate) {
            lastArticle = location.href;
            lastArticleText = text;
          }
        }
      }
    } finally {
      scanning = false;
    }
  }

  const schedule = () => {
    if (stopped) return;
    if (timer !== undefined) return;
    timer = setTimeout(() => {
      timer = undefined;
      void scan();
    }, 1100);
  };
  const observer = new MutationObserver((records) => {
    if (
      records.some(
        (record) =>
          !(
            record.target instanceof Element &&
            record.target.closest("[data-rabbithole-reading]")
          ),
      )
    )
      schedule();
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  document.addEventListener(
    "click",
    (event) => {
      if (!event.isTrusted || event.defaultPrevented) return;
      const link = (event.target as Element)?.closest?.<HTMLAnchorElement>(
        "a[href]",
      );
      if (
        link &&
        /^https?:/.test(link.href) &&
        !link.closest("[data-rabbithole-reading]")
      )
        void message({ type: "research-follow", url: link.href });
    },
    { capture: true, signal: events.signal },
  );
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
      if (msg.rescan) lastArticle = "";
      if (msg.promptInclude) {
        includePrompt = location.href;
        includeSession = msg.sessionId ?? context?.id ?? "";
      }
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
  let placedPosition = { x: 1, y: 0.5 },
    placedPage = "";
  function positionWidget(x: number, y: number) {
    if (!indicator) return;
    placedPosition = {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    };
    const left = 8 + placedPosition.x * Math.max(0, innerWidth - 60),
      top = 8 + placedPosition.y * Math.max(0, innerHeight - 56);
    indicator.style.left = `${left}px`;
    indicator.style.top = `${top}px`;
    indicator.style.right = "auto";
    indicator.dataset.edge = left < innerWidth / 2 ? "left" : "right";
  }
  function placeWidget() {
    const saved = context.widgetPosition ?? { x: 1, y: 0.5 };
    positionWidget(saved.x, saved.y);
    if (saved.x !== placedPosition.x || saved.y !== placedPosition.y) {
      context.widgetPosition = { ...placedPosition };
      void message({ type: "reading-position", position: placedPosition });
    }
    const interactive =
        'button,a[href],input,select,textarea,[role="button"],[tabindex]:not([tabindex="-1"])',
      controls = [...document.querySelectorAll<HTMLElement>(interactive)];
    const blocked = () => {
      if (!indicator || !document.elementsFromPoint) return false;
      const widget = indicator.shadowRoot?.querySelector(".reading-widget"),
        bounds = widget?.getBoundingClientRect(),
        rect = bounds?.width ? bounds : indicator.getBoundingClientRect();
      const cx = (rect.left + rect.right) / 2,
        cy = (rect.top + rect.bottom) / 2;
      return (
        [
          [cx, cy],
          [cx, rect.top + 2],
          [cx, rect.bottom - 2],
          [rect.left + 2, cy],
          [rect.right - 2, cy],
          [rect.left + 2, rect.top + 2],
          [rect.right - 2, rect.top + 2],
          [rect.left + 2, rect.bottom - 2],
          [rect.right - 2, rect.bottom - 2],
        ].some(([x, y]) =>
          document
            .elementsFromPoint(x, y)
            .some(
              (el) =>
                el !== indicator &&
                el.getRootNode() !== indicator!.shadowRoot &&
                !!el.closest(interactive),
            ),
        ) ||
        controls.some((el) => {
          const control = el.getBoundingClientRect();
          return (
            control.width > 0 &&
            control.height > 0 &&
            control.left < rect.right &&
            control.right > rect.left &&
            control.top < rect.bottom &&
            control.bottom > rect.top
          );
        })
      );
    };
    const origin = { ...placedPosition };
    if (blocked()) {
      for (let step = 1; step <= Math.ceil(innerHeight / 56); step++) {
        let clear = false;
        for (const direction of [1, -1]) {
          positionWidget(
            origin.x,
            origin.y + (direction * step * 56) / Math.max(1, innerHeight - 56),
          );
          if (!blocked()) {
            clear = true;
            break;
          }
        }
        if (clear) break;
      }
    }
    placedPage = location.href;
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
      positionWidget(placedPosition.x, placedPosition.y);
    },
    { signal: events.signal },
  );
  let offerHost: HTMLElement | undefined,
    lastOffer = "";
  function shadowStyle(css: string) {
    const style = document.createElement("style");
    style.textContent =
      __RABBIT_TOKENS__
        .replaceAll(
          ':root:not([data-theme="light"])',
          ':host(:not([data-theme="light"]))',
        )
        .replaceAll(':root[data-theme="dark"]', ':host([data-theme="dark"])')
        .replaceAll(":root", ":host") + css;
    return style;
  }
  function hideOffer() {
    offerHost?.remove();
    offerHost = undefined;
  }
  // A card on Google results offering to start or join a rabbit hole. It never
  // captures anything by itself; only a trusted click on its buttons does.
  function showOffer(offer: { kind: string; query: string; title?: string }) {
    hideOffer();
    let image = "";
    try {
      image = chrome.runtime.getURL("rabbithole-mark.svg");
    } catch {
      stop();
      return;
    }
    offerHost = document.createElement("div");
    offerHost.dataset.rabbitholeReading = "true";
    if (context?.theme === "light" || context?.theme === "dark")
      offerHost.dataset.theme = context.theme;
    const shadow = offerHost.attachShadow({ mode: "closed" }),
      card = document.createElement("section");
    card.className = "offer";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "RabbitHole suggestion");
    const el = (tag: string, cls: string, text = "") => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      node.textContent = text;
      return node;
    };
    const head = el("div", "head"),
      mark = document.createElement("img"),
      copy = el("div", "");
    mark.src = image;
    mark.alt = "";
    const short = (t = "") => (t.length > 48 ? t.slice(0, 47) + "…" : t);
    const fresh = offer.kind === "start" || offer.kind === "switch";
    copy.append(
      el(
        "p",
        "title",
        offer.kind === "switch"
          ? "New topic? Start a new rabbit hole"
          : offer.kind === "start"
            ? `Start a rabbit hole for “${short(offer.query)}”?`
            : `Add this search to “${short(offer.title)}”?`,
      ),
      el(
        "p",
        "sub",
        offer.kind === "switch"
          ? `“${short(offer.query)}” doesn’t match “${short(offer.title)}”.`
          : offer.kind === "start"
            ? "RabbitHole saves this search and the pages you open from it."
            : offer.kind === "resume"
              ? "That rabbit hole is paused. Adding resumes it on this tab."
              : "This tab isn’t part of your rabbit hole yet.",
      ),
    );
    head.append(mark, copy);
    card.append(head);
    let goal: HTMLInputElement | undefined,
      familiarity = "";
    if (fresh) {
      goal = document.createElement("input");
      goal.maxLength = 300;
      goal.placeholder = "What are you trying to figure out? (optional)";
      goal.setAttribute("aria-label", "What are you trying to figure out?");
      const row = el("div", "familiar");
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", "How much do you know already?");
      for (const [value, label] of [
        ["new", "New to this"],
        ["some", "Know some"],
        ["solid", "Know it well"],
      ]) {
        const b = el("button", "", label);
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", (e) => {
          if (!e.isTrusted) return;
          familiarity = familiarity === value ? "" : value;
          row
            .querySelectorAll("button")
            .forEach((x) =>
              x.setAttribute("aria-pressed", String(x === b && !!familiarity)),
            );
        });
        row.append(b);
      }
      card.append(goal, row);
    }
    const actions = el("div", "actions"),
      error = el("p", "error");
    let submitting = false;
    const choose = (choice: string) => async (e: Event) => {
      if (!e.isTrusted || submitting) return;
      submitting = true;
      actions.querySelectorAll("button").forEach((b) => (b.disabled = true));
      const result = await message({
        type: "search-accept",
        choice,
        goal: goal?.value.trim() || undefined,
        familiarity: familiarity || undefined,
      });
      if (!result?.saved) {
        submitting = false;
        actions.querySelectorAll("button").forEach((b) => (b.disabled = false));
        error.textContent =
          result?.error ?? "Couldn’t save that choice. Try again.";
        return;
      }
      hideOffer();
      if (choice === "start" || choice === "add") {
        lastUrl = "";
        await scan();
        showReadingNote(
          choice === "start" ? "Rabbit hole started" : "Search added",
        );
      }
    };
    const button = (label: string, choice: string, cls = "") => {
      const b = el("button", cls, label);
      b.addEventListener("click", (e) => void choose(choice)(e));
      actions.append(b);
      return b;
    };

    offer.kind === "start" || offer.kind === "switch"
      ? button(
          offer.kind === "switch" ? "Start new" : "Start",
          "start",
          "primary",
        )
      : button(`Add to “${short(offer.title).slice(0, 22)}”`, "add", "primary");
    if (offer.kind === "resume" || offer.kind === "add")
      button("Start new", "start");
    button(offer.kind === "switch" ? "Keep here" : "Not now", "hush");
    button("Don’t ask", "never", "never");
    card.append(actions, error);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hideOffer();
      if (e.key === "Enter" && e.target === goal && !e.repeat) {
        e.preventDefault();
        void choose("start")(e);
      }
    });
    shadow.append(shadowStyle(offerCSS), card);
    document.documentElement.append(offerHost);
  }
  let indicator: HTMLElement | undefined,
    includePrompt = "",
    includeSession = "",
    noteTimer: ReturnType<typeof setTimeout> | undefined,
    selectionTimer: ReturnType<typeof setTimeout> | undefined,
    dragging = false;
  let intendedSelection: string | undefined;
  function updateIndicator() {
    if (
      includePrompt &&
      (includePrompt !== location.href ||
        includeSession !== context?.id ||
        context?.included ||
        context?.status !== "active")
    )
      includePrompt = "";
    if (
      stopped ||
      (!context?.readingMode && !includePrompt) ||
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
      const shadow = indicator.attachShadow({ mode: "open" });
      shadow.append(shadowStyle(readingCSS));
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
        includePrompt = "";
        await message({
          type: "reading-control",
          control: "hide",
        });
        await scan();
      };
      widget.append(open, pause, hide);
      shadow.append(widget);
      document.documentElement.append(indicator);
      placedPage = "";
    }
    const active = context.status === "active",
      shadow = indicator.shadowRoot!;
    if (includePrompt && !shadow.querySelector(".include-prompt")) {
      const prompt = document.createElement("div");
      prompt.className = "reading-note include-prompt";
      prompt.setAttribute("role", "status");
      const text = document.createElement("span");
      text.textContent =
        "This page isn’t being saved. Add this tab to your rabbit hole?";
      const include = document.createElement("button");
      include.textContent = "Include tab";
      include.onclick = async () => {
        include.disabled = true;
        const result = await message({
          type: "reading-include",
          sessionId: context.id,
        });
        if (result?.saved) {
          includePrompt = "";
          lastArticle = "";
          await scan();
        } else {
          text.textContent =
            result?.error ?? "Couldn’t include this tab. Try again.";
          include.disabled = false;
        }
      };
      const dismiss = document.createElement("button");
      dismiss.textContent = "Not now";
      dismiss.onclick = () => {
        includePrompt = "";
        updateIndicator();
      };
      prompt.append(text, include, dismiss);
      shadow.append(prompt);
    } else if (!includePrompt)
      shadow.querySelector(".include-prompt")?.remove();
    const prompt = shadow.querySelector<HTMLElement>(".include-prompt");
    if (prompt) {
      const above = parseFloat(indicator.style.top) + 210 > innerHeight;
      prompt.style.top = above ? "auto" : "48px";
      prompt.style.bottom = above ? "48px" : "auto";
    }
    if (!widgetDrag && placedPage !== location.href) placeWidget();
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
  function showReadingNote(
    text: string,
    article?: { captureId: string; sessionId: string },
  ) {
    if (!indicator) return;
    const shadow = indicator.shadowRoot!;
    shadow.querySelector(".reading-note")?.remove();
    const note = document.createElement("div");
    note.className = "reading-note";
    note.setAttribute("role", "status");
    note.textContent = text;
    if (article) {
      note.classList.add("article-saved");
      const undo = document.createElement("button");
      undo.textContent = "↶ Undo";
      undo.setAttribute("aria-label", "Undo article save");
      undo.onclick = async () => {
        undo.disabled = true;
        const result = await message({ type: "reading-undo", ...article });
        if (result?.removed) showReadingNote("Article removed");
        else {
          undo.disabled = false;
          undo.title = result?.error ?? "Couldn’t undo. Try again.";
        }
      };
      note.append(undo);
    }
    shadow.append(note);
    const above = parseFloat(indicator.style.top) + 130 > innerHeight;
    note.style.top = above ? "auto" : "48px";
    note.style.bottom = above ? "48px" : "auto";
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => note.remove(), article ? 10000 : 2200);
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
  if (googleQuery(location.href)) void scan();
  else schedule();
})();
