import {
  Preferences,
  Capture,
  type Session,
} from "../../../packages/contracts/src/index";
import type { Handoff } from "./handoff";
import { googleQuery } from "./google";
import { isExcluded, looksUnrelated, siteKey } from "./exclusion";
import { visibleAnalysis } from "../../../packages/contracts/src/sources";
type Offer = { query: string; at: number; kind: string };
type Local = {
  sessions: Record<string, Session>;
  active?: string;
  tabs: Record<string, string>;
  lastCapture: Record<string, string>;
  searchSession?: string;
  excluded: Record<string, string[]>;
  queue: { id: string; method: string; path: string; body?: unknown }[];
  config: { backend: string; token: string; agentUrl: string };
  error?: string;
  readingMode?: boolean;
  handoffs?: Record<string, Handoff>;
  widgetPosition?: { x: number; y: number };
  askOnSearch?: boolean;
  // Tab-scoped like bindings: cleared on browser restart.
  offers: Record<string, Offer>;
  hush: Record<string, number>;
  // Content hashes, scoped to a session and page; never retain deleted source text.
  dismissed: Record<string, Record<string, string[]>>;
};
const initial: Local = {
  sessions: {},
  tabs: {},
  lastCapture: {},
  offers: {},
  hush: {},
  dismissed: {},
  excluded: {},
  queue: [],
  config: {
    backend: "http://localhost:3210",
    token: "",
    agentUrl: "https://go.superhuman.com",
  },
};
const load = async (): Promise<Local> => {
  const local = (await chrome.storage.local.get("state")).state as
    Partial<Local> | undefined;
  const state: Local = { ...initial, ...local };
  const bindings = (await chrome.storage.session.get("bindings")).bindings as
    | {
        tabs: Record<string, string>;
        lastCapture: Record<string, string>;
        searchSession?: string;
        offers?: Record<string, Offer>;
        hush?: Record<string, number>;
      }
    | undefined;
  state.tabs = bindings?.tabs ?? {};
  state.offers = bindings?.offers ?? {};
  state.hush = bindings?.hush ?? {};
  state.lastCapture = bindings?.lastCapture ?? {};
  state.searchSession = bindings?.searchSession;
  for (const handoff of Object.values(state.handoffs ?? {}))
    if (Date.now() - Date.parse(handoff.startedAt) > 10 * 60_000)
      handoff.status = "stalled";
  // Session storage survives worker suspension but is cleared by a browser restart.
  // Never trust persisted tab IDs after restart, even if onStartup was not delivered.
  if (!bindings) {
    for (const session of Object.values(state.sessions)) {
      if (session.status === "active") {
        session.status = "paused";
        state.queue.push({
          id: crypto.randomUUID(),
          method: "PATCH",
          path: `/api/sessions/${session.id}`,
          body: { status: "paused" },
        });
      }
    }
    await chrome.storage.session.set({
      bindings: { tabs: {}, lastCapture: {} },
    });
    await chrome.storage.local.set({
      state: { ...state, tabs: {}, lastCapture: {}, offers: {}, hush: {} },
    });
  }
  return state;
};
const persist = async (s: Local) => {
  await chrome.storage.local.set({
    state: { ...s, tabs: {}, lastCapture: {}, offers: {}, hush: {} },
  });
  await chrome.storage.session.set({
    bindings: {
      tabs: s.tabs,
      lastCapture: s.lastCapture,
      searchSession: s.searchSession,
      offers: s.offers,
      hush: s.hush,
    },
  });
};
const enqueue = (s: Local, method: string, path: string, body?: unknown) =>
  s.queue.push({ id: crypto.randomUUID(), method, path, body });
function startContext(tab?: chrome.tabs.Tab) {
  const regular = !tab?.incognito && /^https?:/.test(tab?.url ?? "");
  const url = tab?.url ? new URL(tab.url) : undefined;
  const workspace =
    !tab?.incognito &&
    url?.href.split(/[?#]/)[0] === chrome.runtime.getURL("index.html") &&
    url?.searchParams.has("workspace");
  return { regular, canStart: !!tab?.id && (regular || !!workspace) };
}
function enrollSearch(s: Local, tab?: chrome.tabs.Tab) {
  const session = s.active ? s.sessions[s.active] : undefined;
  if (
    tab?.id !== undefined &&
    tab.active &&
    !tab.incognito &&
    session?.status === "active" &&
    s.searchSession === session.id &&
    /^https?:/.test(tab.url ?? "") &&
    googleQuery(tab.url!) &&
    !isExcluded(s.excluded[session.id], tab.url!)
  )
    s.tabs[tab.id] = session.id;
}
function createSession(
  s: Local,
  input: { title?: unknown; goal?: unknown; familiarity?: unknown },
) {
  if (s.active && s.sessions[s.active]?.status === "active") {
    s.sessions[s.active].status = "paused";
    enqueue(s, "PATCH", `/api/sessions/${s.active}`, { status: "paused" });
  }
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const goal = String(input.goal ?? "")
      .trim()
      .slice(0, 300),
    familiarity = ["new", "some", "solid"].includes(String(input.familiarity))
      ? (input.familiarity as Session["familiarity"])
      : undefined;
  const session: Session = {
    id,
    title:
      String(input.title ?? "")
        .trim()
        .slice(0, 140) || "New rabbit hole",
    ...(goal && { goal }),
    ...(familiarity && { familiarity }),
    status: "active",
    createdAt: now,
    updatedAt: now,
    version: 0,
    settings: Preferences.parse({}),
    analysis: null,
    processed: [],
    captures: [],
    attempts: [],
  };
  s.sessions[id] = session;
  s.active = id;
  s.searchSession = id;
  s.readingMode = true;
  enqueue(s, "POST", "/api/sessions", {
    id,
    title: session.title,
    settings: session.settings,
    ...(goal && { goal }),
    ...(familiarity && { familiarity }),
  });
  return session;
}
async function captureFingerprint(c: { sourceType: string; text: string }) {
  const bytes = new TextEncoder().encode(
    JSON.stringify([c.sourceType, c.text]),
  );
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
async function removeCapture(s: Local, session: Session, captureId: string) {
  const path = `/api/sessions/${session.id}/captures/${captureId}`;
  const c = session.captures.find((x) => x.id === captureId);
  if (c) {
    const pages = (s.dismissed[session.id] ??= {});
    pages[c.url] = [
      ...new Set([...(pages[c.url] ?? []), await captureFingerprint(c)]),
    ];
  }
  session.captures = session.captures.filter((x) => x.id !== captureId);
  session.processed = session.processed.filter((x) => x !== captureId);
  session.hidden = (session.hidden ?? []).filter((x) => x !== captureId);
  session.removed = [...(session.removed ?? []), captureId];
  session.analysis = visibleAnalysis({ ...session, hidden: [] });
  s.queue = s.queue.filter(
    (q) =>
      q.path !== path &&
      !(
        q.method === "POST" &&
        q.path === `/api/sessions/${session.id}/captures` &&
        (q.body as any)?.id === captureId
      ),
  );
  // A queued POST may already have committed remotely before its response failed.
  enqueue(s, "DELETE", path);
  for (const [tab, last] of Object.entries(s.lastCapture))
    if (last === captureId) delete s.lastCapture[tab];
}
// Decide whether a Google search on this tab deserves a "start a rabbit hole?" card.
function searchOffer(s: Local, tab: chrome.tabs.Tab, query: string) {
  const id = String(tab.id),
    session = s.active ? s.sessions[s.active] : undefined;
  if (s.askOnSearch === false || (s.hush[id] ?? 0) > Date.now()) return null;
  if (session && isExcluded(s.excluded[session.id], tab.url ?? "")) return null;
  if (s.offers[id]?.query === query) return null;
  let kind: string | null = null;
  if (session?.status === "active" && s.tabs[id] === session.id) {
    const seen = [
      session.goal ?? "",
      ...session.captures
        .filter((c) => c.sourceType === "search")
        .map((c) => c.text),
    ].filter((t) => t && t !== query);
    if (seen.length && looksUnrelated(query, seen)) kind = "switch";
  } else if (session?.status === "active") kind = "add";
  else kind = session?.status === "paused" ? "resume" : "start";
  if (!kind) return null;
  s.offers[id] = { query, at: Date.now(), kind };
  return { kind, query, title: session?.title };
}
async function flush(s: Local) {
  if (!s.config.token) {
    s.error =
      "Add your personal backend token in Settings. Captures stay on this device.";
    return;
  }
  while (s.queue.length) {
    const q = s.queue[0];
    try {
      const r = await fetch(s.config.backend + q.path, {
        method: q.method,
        headers: {
          Authorization: `Bearer ${s.config.token}`,
          "Content-Type": "application/json",
        },
        body: q.body === undefined ? undefined : JSON.stringify(q.body),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) {
        if (r.status === 404 && q.method !== "DELETE") {
          s.error =
            "A session no longer exists on the server. Export local data or delete the local session.";
          break;
        }
        if (!(r.status === 404 && q.method === "DELETE"))
          throw new Error(
            `Sync failed (${r.status}); check settings or export local data.`,
          );
      }
      s.queue.shift();
      s.error = undefined;
      await persist(s);
    } catch (e) {
      s.error = e instanceof Error ? e.message : "Offline; saved locally";
      break;
    }
  }
}
async function register() {
  if (
    await chrome.permissions.contains({
      origins: ["http://*/*", "https://*/*"],
    })
  ) {
    await chrome.scripting.unregisterContentScripts().catch(() => {});
    await chrome.scripting.registerContentScripts([
      {
        id: "research",
        matches: ["http://*/*", "https://*/*"],
        js: ["content.js"],
        runAt: "document_idle",
        allFrames: false,
        persistAcrossSessions: true,
      },
    ]);
  }
}
chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  void chrome.contextMenus.create({
    id: "save",
    title: "Save to RabbitHole",
    contexts: ["selection"],
  });
  void chrome.contextMenus.create({
    id: "save-confusing",
    title: "Save to RabbitHole — confusing",
    contexts: ["selection"],
  });
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  void chrome.alarms.create("sync", { periodInMinutes: 1 });
  void register();
});
chrome.runtime.onStartup.addListener(() => {
  void register();
  void transact(async (s) => {
    s.tabs = {};
    s.lastCapture = {};
    for (const session of Object.values(s.sessions)) {
      if (session.status === "active") {
        session.status = "paused";
        enqueue(s, "PATCH", `/api/sessions/${session.id}`, {
          status: "paused",
        });
      }
    }
    await flush(s);
  });
});
let chain = Promise.resolve();
function transact(fn: (s: Local) => Promise<unknown>) {
  const work = chain.then(async () => {
    const s = await load();
    const before = JSON.stringify(s);
    const result = await fn(s);
    if (JSON.stringify(s) !== before) await persist(s);
    return result;
  });
  chain = work.then(
    () => {},
    () => {},
  );
  return work;
}
chrome.alarms.onAlarm.addListener(
  () =>
    void transact(async (s) => {
      await flush(s);
      return Object.keys(s.handoffs ?? {}).length > 0;
    }).then((waiting) => {
      if (waiting)
        return handle(
          { type: "refresh" },
          { id: chrome.runtime.id, url: chrome.runtime.getURL("") },
        );
    }),
);
chrome.tabs.onCreated.addListener((tab) => {
  void transact(async (s) => {
    if (
      tab.id !== undefined &&
      tab.openerTabId !== undefined &&
      s.tabs[tab.openerTabId] === s.active
    )
      s.tabs[tab.id] = s.active!;
  });
});
chrome.tabs.onRemoved.addListener(
  (id) =>
    void transact(async (s) => {
      delete s.tabs[id];
      delete s.lastCapture[id];
    }),
);
async function capture(
  s: Local,
  payload: unknown,
  tabId: number,
  automatic = false,
) {
  const session = s.active ? s.sessions[s.active] : undefined;
  if (!session || session.status !== "active" || s.tabs[tabId] !== session.id)
    return { ignored: true };
  const parsed = Capture.parse(payload);
  if (
    parsed.sessionId !== session.id ||
    isExcluded(s.excluded[session.id], parsed.url)
  )
    return { ignored: true };
  if (parsed.sourceType === "article" && !session.settings.articleCapture)
    return { ignored: true };
  if (
    (parsed.sourceType !== "highlight" || automatic) &&
    s.dismissed[session.id]?.[parsed.url]?.includes(
      await captureFingerprint(parsed),
    )
  )
    return { ignored: true };
  if (
    session.captures.some(
      (c) =>
        c.sourceType === parsed.sourceType &&
        c.url === parsed.url &&
        c.text === parsed.text,
    )
  )
    return { duplicate: true };
  if (
    session.captures.length >= 300 ||
    new TextEncoder().encode(JSON.stringify(s)).length +
      parsed.text.length * 8 +
      4096 >
      8_000_000
  ) {
    s.error =
      "Research storage limit reached. Export and delete older sessions before continuing.";
    await persist(s);
    await chrome.action.setBadgeText({ text: "!" });
    throw new Error(s.error);
  }
  parsed.parentCaptureId = s.lastCapture[tabId];
  session.captures.push(parsed);
  s.lastCapture[tabId] = parsed.id;
  if (session.title === "New rabbit hole" && parsed.sourceType === "search")
    session.title = parsed.text.slice(0, 140);
  enqueue(s, "POST", `/api/sessions/${session.id}/captures`, parsed);
  await persist(s);
  return { saved: true };
}
async function handle(msg: any, sender: chrome.runtime.MessageSender) {
  return transact(async (s) => {
    const internal =
      sender.id === chrome.runtime.id &&
      sender.url?.startsWith(chrome.runtime.getURL(""));
    if (msg.type === "reading-context") {
      const id = sender.tab?.id,
        session = s.active ? s.sessions[s.active] : undefined;
      if ((sender.frameId ?? 0) === 0 && sender.url === sender.tab?.url)
        enrollSearch(s, sender.tab);
      if (
        id === undefined ||
        sender.tab?.incognito ||
        !/^https?:/.test(sender.tab?.url ?? "") ||
        (sender.frameId ?? 0) !== 0 ||
        !session ||
        isExcluded(s.excluded[session.id], sender.tab!.url ?? "")
      )
        return null;
      return {
        id: session.id,
        status: session.status,
        settings:
          s.tabs[id] === session.id
            ? session.settings
            : { articleCapture: false, autoHighlights: false },
        excluded:
          s.tabs[id] === session.id &&
          isExcluded(s.excluded[session.id], sender.tab!.url ?? "")
            ? [sender.tab!.url]
            : [],
        readingMode: s.readingMode ?? false,
        included: s.tabs[id] === session.id,
        widgetPosition: s.widgetPosition,
        theme: (await chrome.storage.local.get("uiTheme")).uiTheme,
        handoff: s.handoffs?.[session.id]?.status,
        syncError: !!s.error,
      };
    }
    if (msg.type === "reading-position") {
      const p = msg.position;
      if (
        (!internal &&
          (sender.tab?.incognito ||
            !/^https?:/.test(sender.tab?.url ?? "") ||
            (sender.frameId ?? 0) !== 0)) ||
        !p ||
        ![p.x, p.y].every(
          (v) =>
            typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1,
        )
      )
        throw new Error("Invalid widget position");
      s.widgetPosition = { x: p.x, y: p.y };
      return { saved: true };
    }
    if (msg.type === "reading-control") {
      const id = sender.tab?.id,
        session = s.active ? s.sessions[s.active] : undefined;
      if (
        id === undefined ||
        sender.tab?.incognito ||
        !session ||
        !/^https?:/.test(sender.tab?.url ?? "") ||
        (sender.frameId ?? 0) !== 0
      )
        throw new Error("This page is not in the active session");
      if (msg.control === "hide") s.readingMode = false;
      else if (msg.control === "pause" || msg.control === "resume") {
        session.status = msg.control === "pause" ? "paused" : "active";
        enqueue(s, "PATCH", `/api/sessions/${session.id}`, {
          status: session.status,
        });
      } else throw new Error("Unknown reading control");
      await flush(s);
      return { saved: true };
    }
    if (msg.type === "context") {
      const session = s.active ? s.sessions[s.active] : undefined;
      const allowed =
        sender.tab?.id !== undefined &&
        s.tabs[sender.tab.id] === s.active &&
        session?.status === "active" &&
        !sender.tab.incognito;
      return allowed
        ? {
            id: session.id,
            settings: session.settings,
            excluded: isExcluded(s.excluded[session.id], sender.tab!.url ?? "")
              ? [sender.tab!.url]
              : [],
          }
        : null;
    }
    if (msg.type === "search-offer" || msg.type === "search-accept") {
      const tab = sender.tab,
        query = googleQuery(tab?.url ?? "");
      if (
        tab?.id === undefined ||
        tab.incognito ||
        (sender.frameId ?? 0) !== 0 ||
        sender.url !== tab.url ||
        !query
      )
        return null;
      if (msg.type === "search-offer") return searchOffer(s, tab, query);
      const id = String(tab.id),
        offer = s.offers[id];
      // Only answer a card this worker actually showed for the current search.
      if (
        !offer ||
        offer.query !== query ||
        Date.now() - offer.at > 15 * 60_000
      )
        throw new Error(
          "This suggestion expired. Use RabbitHole's side panel.",
        );
      if (msg.choice === "hush") s.hush[id] = Date.now() + 30 * 60_000;
      else if (msg.choice === "never") s.askOnSearch = false;
      else if (msg.choice === "start") {
        const old = s.active ? s.sessions[s.active] : undefined;
        // A search that started a new topic moves out of the old rabbit hole.
        const moved =
          offer.kind === "switch" &&
          old?.captures.find(
            (c) =>
              c.sourceType === "search" &&
              c.text === query &&
              c.url === tab.url &&
              !old.processed.includes(c.id),
          );
        if (old && moved) await removeCapture(s, old, moved.id);
        delete s.lastCapture[id];
        createSession(s, {
          title: query,
          goal: msg.goal,
          familiarity: msg.familiarity,
        });
        s.tabs[id] = s.active!;
      } else if (msg.choice === "add" && s.active) {
        const session = s.sessions[s.active];
        if (session.status !== "active") {
          session.status = "active";
          enqueue(s, "PATCH", `/api/sessions/${session.id}`, {
            status: "active",
          });
        }
        s.tabs[id] = session.id;
        s.searchSession = session.id;
      } else throw new Error("Unknown choice");
      await persist(s);
      await flush(s);
      return { saved: true, choice: msg.choice };
    }
    if (
      msg.type === "capture" &&
      sender.tab?.id !== undefined &&
      !sender.tab.incognito
    ) {
      const source = new URL(msg.capture?.url);
      if (!sender.url || new URL(sender.url).origin !== source.origin)
        throw new Error("Capture origin mismatch");
      if (msg.automatic && !s.sessions[s.active ?? ""]?.settings.autoHighlights)
        return { ignored: true };
      return capture(s, msg.capture, sender.tab.id, !!msg.automatic);
    }
    if (!internal)
      throw new Error("This operation is available only in RabbitHole");
    if (msg.type === "ui-context") {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      if (tab) enrollSearch(s, { ...tab, active: true });
      return {
        tabId: tab?.id,
        url: tab?.url ?? "",
        title: tab?.title ?? "",
        ...startContext(tab),
        included: tab?.id !== undefined && s.tabs[tab.id] === s.active,
        count: Object.values(s.tabs).filter((id) => id === s.active).length,
        excluded: !!tab?.url && isExcluded(s.excluded[s.active ?? ""], tab.url),
        askOnSearch: s.askOnSearch !== false,
      };
    }
    if (msg.type === "reading-mode") {
      s.readingMode = true;
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      if (tab?.id !== undefined && s.tabs[tab.id] === s.active)
        await chrome.tabs
          .sendMessage(tab.id, { type: "reading-update" })
          .catch(() => {});
      await persist(s);
      const close = (
        chrome.sidePanel as unknown as {
          close?: (options: { windowId: number }) => Promise<void>;
        }
      ).close;
      if (close && tab?.windowId !== undefined)
        await close({ windowId: tab.windowId }).catch(() => {});
      return s;
    }
    if (msg.type === "open-panel") {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      if (tab?.windowId !== undefined)
        await chrome.sidePanel.open({ windowId: tab.windowId });
      return s;
    }
    if (msg.type === "state") return s;
    if (msg.type === "handoff" || msg.type === "handoff-cancel") {
      const session = s.sessions[msg.id];
      if (!session) throw new Error("Unknown session");
      s.handoffs ??= {};
      if (msg.type === "handoff-cancel") delete s.handoffs[msg.id];
      else {
        if (typeof msg.prompt !== "string" || msg.prompt.length > 20_000)
          throw new Error("Invalid handoff prompt");
        const previous = s.handoffs[msg.id];
        s.handoffs[msg.id] = {
          sessionId: msg.id,
          prompt: msg.prompt,
          copied: !!msg.copied,
          opened: !!msg.opened,
          version: previous?.version ?? session.version,
          captureIds:
            previous?.captureIds ??
            (msg.intent === "rebuild"
              ? []
              : session.captures
                  .filter(
                    (c) =>
                      !session.processed.includes(c.id) &&
                      !session.hidden?.includes(c.id),
                  )
                  .slice(0, 24)
                  .map((c) => c.id)),
          startedAt: previous?.startedAt ?? new Date().toISOString(),
          status: previous?.status ?? "waiting",
        };
      }
      return s;
    }
    if (msg.type === "config") {
      const url = new URL(msg.config.backend);
      if (
        url.protocol !== "https:" &&
        !(
          url.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(url.hostname)
        )
      )
        throw new Error("Use HTTPS for remote backends");
      const go = new URL(msg.config.agentUrl);
      if (go.protocol !== "https:") throw new Error("Agent URL must use HTTPS");
      s.config = {
        backend: url.href.replace(/\/$/, ""),
        token: String(msg.config.token),
        agentUrl: go.href,
      };
      await register();
    }
    if (msg.type === "start") {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      const context = startContext(tab);
      if (!context.canStart || sender.tab?.incognito)
        throw new Error("Open a regular research webpage first");
      const { id } = createSession(s, msg);
      if (context.regular) s.tabs[tab!.id!] = id;
      await persist(s);
      await register();
      if (context.regular)
        await chrome.scripting.executeScript({
          target: { tabId: tab!.id! },
          files: ["content.js"],
        });
    }
    if (msg.type === "include") {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      if (
        !tab?.id ||
        !s.active ||
        tab.incognito ||
        !/^https?:/.test(tab.url ?? "")
      )
        throw new Error("Open a research webpage first");
      s.tabs[tab.id] = s.active;
      s.searchSession = s.active;
      if (s.dismissed[s.active]) delete s.dismissed[s.active][tab.url!];
      await persist(s);
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
      await chrome.tabs
        .sendMessage(tab.id, { type: "reading-update", rescan: true })
        .catch(() => {});
    }
    if (msg.type === "select") {
      if (s.active && s.active !== msg.id) {
        const old = s.sessions[s.active];
        old.status = "paused";
        enqueue(s, "PATCH", `/api/sessions/${old.id}`, { status: "paused" });
      }
      s.active = msg.id;
    }
    if (msg.type === "patch") {
      const session = s.sessions[msg.id];
      if (!session) throw new Error("Session missing");
      Object.assign(session, msg.patch);
      enqueue(s, "PATCH", `/api/sessions/${msg.id}`, msg.patch);
    }
    if (msg.type === "exclude" || msg.type === "exclude-site") {
      const [tab] = msg.url
        ? [{ url: String(msg.url) }]
        : await chrome.tabs.query({
            active: true,
            lastFocusedWindow: true,
          });
      const entry =
        tab?.url && (msg.type === "exclude-site" ? siteKey(tab.url) : tab.url);
      if (s.active && entry) {
        s.excluded[s.active] = [
          ...new Set([...(s.excluded[s.active] ?? []), entry]),
        ];
      }
    }
    if (msg.type === "ask-on-search") s.askOnSearch = !!msg.value;
    if (
      msg.type === "capture-hide" ||
      msg.type === "capture-tag" ||
      msg.type === "capture-delete"
    ) {
      const session = s.sessions[msg.id],
        c = session?.captures.find((c) => c.id === msg.captureId);
      if (!session || !c) throw new Error("That find no longer exists");
      const path = `/api/sessions/${session.id}/captures/${c.id}`;
      if (msg.type === "capture-hide") {
        session.hidden = msg.hidden
          ? [...new Set([...(session.hidden ?? []), c.id])]
          : (session.hidden ?? []).filter((h) => h !== c.id);
        enqueue(s, "PATCH", path, { hidden: !!msg.hidden });
      } else if (msg.type === "capture-tag") {
        if (!["important", "confusing", "none"].includes(msg.tag))
          throw new Error("Unknown tag");
        c.tag = msg.tag;
        enqueue(s, "PATCH", path, { tag: msg.tag });
      } else await removeCapture(s, session, c.id);
      await persist(s);
    }
    if (msg.type === "unexclude" && s.active) {
      s.excluded[s.active] = (s.excluded[s.active] ?? []).filter(
        (url) => url !== msg.url,
      );
    }
    if (msg.type === "delete") {
      delete s.sessions[msg.id];
      s.queue = s.queue.filter(
        (q) =>
          !q.path.includes(msg.id) &&
          !(q.path === "/api/sessions" && (q.body as any)?.id === msg.id),
      );
      if (s.active === msg.id) s.active = undefined;
      for (const id of Object.keys(s.tabs))
        if (s.tabs[id] === msg.id) delete s.tabs[id];
      delete s.excluded[msg.id];
      delete s.dismissed[msg.id];
      enqueue(s, "DELETE", `/api/sessions/${msg.id}`);
      await persist(s);
    }
    if (msg.type === "review") {
      const session = s.sessions[msg.id];
      if (session.version !== msg.attempt.analysisVersion)
        throw new Error("Refresh study material");
      session.attempts.push(msg.attempt);
      enqueue(s, "POST", `/api/sessions/${msg.id}/reviews`, msg.attempt);
    }
    if (
      [
        "patch",
        "exclude",
        "exclude-site",
        "unexclude",
        "reading-mode",
        "select",
      ].includes(msg.type)
    )
      for (const id of Object.keys(s.tabs))
        void chrome.tabs
          .sendMessage(Number(id), { type: "reading-update" })
          .catch(() => {});
    await flush(s);
    if (msg.type === "refresh" && s.config.token) {
      try {
        const r = await fetch(s.config.backend + "/api/sessions", {
          headers: { Authorization: `Bearer ${s.config.token}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) throw new Error(`Refresh failed (${r.status})`);
        const list = await r.json();
        for (const brief of list) {
          if (
            s.queue.some(
              (q) => q.method === "DELETE" && q.path.endsWith(brief.id),
            )
          )
            continue;
          const detail = await fetch(
            s.config.backend + `/api/sessions/${brief.id}`,
            {
              headers: { Authorization: `Bearer ${s.config.token}` },
              signal: AbortSignal.timeout(10000),
            },
          );
          if (!detail.ok) continue;
          const remote: Session = await detail.json(),
            local = s.sessions[brief.id];
          if (
            local &&
            s.queue.some((q) =>
              q.path.startsWith(`/api/sessions/${local.id}/captures/`),
            )
          ) {
            // Unsynced hide/tag/delete changes win over the server's copy.
            remote.hidden = local.hidden;
            remote.removed = local.removed;
            remote.captures = remote.captures
              .filter((c) => !local.removed?.includes(c.id))
              .map((c) => local.captures.find((l) => l.id === c.id) ?? c);
          }
          if (local) {
            remote.captures.push(
              ...local.captures.filter(
                (c) =>
                  !remote.captures.some((rc) => rc.id === c.id) &&
                  !remote.removed?.includes(c.id),
              ),
            );
            remote.attempts.push(
              ...local.attempts.filter(
                (a) => !remote.attempts.some((ra) => ra.id === a.id),
              ),
            );
          }
          s.sessions[remote.id] = remote;
          const handoff = s.handoffs?.[remote.id];
          if (
            handoff &&
            remote.version > handoff.version &&
            handoff.captureIds.every((id) => remote.processed.includes(id))
          )
            delete s.handoffs![remote.id];
        }
        s.error = undefined;
      } catch (e) {
        s.error = e instanceof Error ? e.message : "Offline";
      }
    }
    return s;
  });
}
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (
    msg.type === "reading-open" &&
    sender.id === chrome.runtime.id &&
    sender.tab?.windowId !== undefined
  ) {
    void chrome.sidePanel
      .open({ windowId: sender.tab.windowId })
      .then(() => reply({ opened: true }))
      .catch(() => reply({ error: "Open RabbitHole from its toolbar icon" }));
    return true;
  }
  void handle(msg, sender)
    .then(reply)
    .catch((e) => reply({ error: e.message }));
  return true;
});
async function selected(tabId: number, tag = "important") {
  await chrome.tabs
    .sendMessage(tabId, { type: "highlight", tag })
    .catch(() => {});
}
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (
    (info.menuItemId === "save" || info.menuItemId === "save-confusing") &&
    tab?.id
  )
    void selected(
      tab.id,
      info.menuItemId === "save-confusing" ? "confusing" : "important",
    );
});
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "open-workspace") {
    void chrome.tabs.create({
      url: chrome.runtime.getURL("index.html?workspace=1#map"),
    });
    return;
  }
  if (command === "open-panel") {
    if (tab?.windowId !== undefined)
      void chrome.sidePanel.open({ windowId: tab.windowId });
    return;
  }
  if (command === "toggle-indicator") {
    void transact(async (s) => {
      s.readingMode = !s.readingMode;
      if (
        tab?.id !== undefined &&
        !tab.incognito &&
        /^https?:/.test(tab.url ?? "")
      ) {
        await persist(s);
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        });
        await chrome.tabs
          .sendMessage(tab.id, { type: "reading-update" })
          .catch(() => {});
      }
    });
    return;
  }
  if (command !== "save-highlight") return;
  void chrome.tabs
    .query({ active: true, lastFocusedWindow: true })
    .then(([tab]) => {
      if (tab?.id) void selected(tab.id);
    });
});
