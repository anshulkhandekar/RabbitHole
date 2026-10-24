import { Readability } from "@mozilla/readability";
import { googleQuery, overview } from "./google";
(() => {
  const key = "__rabbitHoleInstalled";
  if ((globalThis as any)[key]) {
    void chrome.runtime
      .sendMessage({ type: "context" })
      .then(() => window.dispatchEvent(new Event("rabbithole-refresh")));
    return;
  }
  (globalThis as any)[key] = true;
  let context: any = null,
    lastUrl = "",
    lastArticle = "",
    timer: ReturnType<typeof setTimeout> | undefined;
  const send = async (
    type: string,
    text: string,
    references: string[] = [],
    tag = "none",
  ) => {
    if (!context || context.excluded.includes(location.href) || !text.trim())
      return;
    await chrome.runtime
      .sendMessage({
        type: "capture",
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
      })
      .catch(() => {});
  };
  function safeClone() {
    const clone = document.cloneNode(true) as Document;
    clone
      .querySelectorAll(
        'input,textarea,select,[contenteditable],script,style,nav,footer,header,aside,form,[hidden],[role="navigation"],[aria-hidden="true"]',
      )
      .forEach((el) => el.remove());
    return clone;
  }
  async function scan() {
    context = await chrome.runtime
      .sendMessage({ type: "context" })
      .catch(() => null);
    if (!context || document.visibilityState !== "visible") return;
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
  document.addEventListener("visibilitychange", schedule);
  window.addEventListener("popstate", schedule);
  window.addEventListener("rabbithole-refresh", schedule);
  // A low-frequency URL check handles History API navigation and session pause/resume.
  setInterval(() => {
    if (document.visibilityState === "visible") schedule();
  }, 6000);
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.type !== "highlight") return;
    void (async () => {
      context = await chrome.runtime.sendMessage({ type: "context" });
      const focused = document.activeElement;
      if (
        focused &&
        (focused.matches("input,textarea,select") ||
          focused.closest("[contenteditable]"))
      )
        return { ignored: true };
      const sel = window.getSelection();
      if (
        sel?.anchorNode?.parentElement?.closest(
          "input,textarea,[contenteditable]",
        ) ||
        sel?.focusNode?.parentElement?.closest(
          "input,textarea,[contenteditable]",
        )
      )
        return { ignored: true };
      if (!context)
        return { error: "Start or resume an included session first" };
      await send(
        "highlight",
        sel?.toString() ?? "",
        [],
        msg.tag ?? "important",
      );
      return { saved: true };
    })()
      .then(reply)
      .catch(() => reply({ error: "Selection unavailable" }));
    return true;
  });
  schedule();
})();
