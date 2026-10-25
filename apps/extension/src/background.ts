import {
  Preferences,
  Capture,
  type Session,
} from "../../../packages/contracts/src/index";
type Local = {
  sessions: Record<string, Session>;
  active?: string;
  tabs: Record<string, string>;
  lastCapture: Record<string, string>;
  excluded: Record<string, string[]>;
  queue: { id: string; method: string; path: string; body?: unknown }[];
  config: { backend: string; token: string; agentUrl: string };
  error?: string;
  readingMode?: boolean;
};
const initial: Local = {
  sessions: {},
  tabs: {},
  lastCapture: {},
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
    | { tabs: Record<string, string>; lastCapture: Record<string, string> }
    | undefined;
  state.tabs = bindings?.tabs ?? {};
  state.lastCapture = bindings?.lastCapture ?? {};
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
      state: { ...state, tabs: {}, lastCapture: {} },
    });
  }
  return state;
};
const persist = async (s: Local) => {
  await chrome.storage.local.set({
    state: { ...s, tabs: {}, lastCapture: {} },
  });
  await chrome.storage.session.set({
    bindings: { tabs: s.tabs, lastCapture: s.lastCapture },
  });
};
const enqueue = (s: Local, method: string, path: string, body?: unknown) =>
  s.queue.push({ id: crypto.randomUUID(), method, path, body });
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
    const result = await fn(s);
    await persist(s);
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
async function capture(s: Local, payload: unknown, tabId: number) {
  const session = s.active ? s.sessions[s.active] : undefined;
  if (!session || session.status !== "active" || s.tabs[tabId] !== session.id)
    return { ignored: true };
  const parsed = Capture.parse(payload);
  if (
    parsed.sessionId !== session.id ||
    s.excluded[session.id]?.includes(parsed.url)
  )
    return { ignored: true };
  if (parsed.sourceType === "article" && !session.settings.articleCapture)
    return { ignored: true };
  if (
    session.captures.some(
      (c) =>
        c.sourceType === parsed.sourceType &&
        c.url === parsed.url &&
        c.text === parsed.text &&
        c.tag === parsed.tag,
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
      if (
        id === undefined ||
        sender.tab?.incognito ||
        s.tabs[id] !== session?.id ||
        !session ||
        s.excluded[session.id]?.includes(sender.tab!.url ?? "")
      )
        return null;
      return {
        id: session.id,
        status: session.status,
        settings: session.settings,
        excluded: s.excluded[session.id] ?? [],
        readingMode: s.readingMode ?? false,
      };
    }
    if (msg.type === "reading-control") {
      const id = sender.tab?.id,
        session = s.active ? s.sessions[s.active] : undefined;
      if (
        id === undefined ||
        sender.tab?.incognito ||
        !session ||
        s.tabs[id] !== session.id
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
            excluded: s.excluded[session.id] ?? [],
          }
        : null;
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
      return capture(s, msg.capture, sender.tab.id);
    }
    if (!internal)
      throw new Error("This operation is available only in RabbitHole");
    if (msg.type === "ui-context") {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      return {
        tabId: tab?.id,
        url: tab?.url ?? "",
        title: tab?.title ?? "",
        regular: !tab?.incognito && /^https?:/.test(tab?.url ?? ""),
        included: tab?.id !== undefined && s.tabs[tab.id] === s.active,
        count: Object.values(s.tabs).filter((id) => id === s.active).length,
        excluded:
          !!tab?.url && (s.excluded[s.active ?? ""] ?? []).includes(tab.url),
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
      if (!tab?.id || tab.incognito || !/^https?:/.test(tab.url ?? ""))
        throw new Error("Open a regular research webpage first");
      if (s.active && s.sessions[s.active]) {
        s.sessions[s.active].status = "paused";
        enqueue(s, "PATCH", `/api/sessions/${s.active}`, { status: "paused" });
      }
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const session: Session = {
        id,
        title: "New rabbit hole",
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
      s.tabs[tab.id] = id;
      enqueue(s, "POST", "/api/sessions", {
        id,
        title: session.title,
        settings: session.settings,
      });
      await persist(s);
      await register();
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
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
      await persist(s);
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"],
      });
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
    if (msg.type === "exclude") {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      if (s.active && tab?.url) {
        s.excluded[s.active] = [
          ...new Set([...(s.excluded[s.active] ?? []), tab.url]),
        ];
      }
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
      ["patch", "exclude", "unexclude", "reading-mode", "select"].includes(
        msg.type,
      )
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
          if (local) {
            remote.captures.push(
              ...local.captures.filter(
                (c) => !remote.captures.some((rc) => rc.id === c.id),
              ),
            );
            remote.attempts.push(
              ...local.attempts.filter(
                (a) => !remote.attempts.some((ra) => ra.id === a.id),
              ),
            );
          }
          s.sessions[remote.id] = remote;
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
chrome.commands.onCommand.addListener(() => {
  void chrome.tabs
    .query({ active: true, lastFocusedWindow: true })
    .then(([tab]) => {
      if (tab?.id) void selected(tab.id);
    });
});
