import { runInNewContext } from "node:vm";
import { webcrypto } from "node:crypto";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["apps/extension/src/background.ts"],
  bundle: true,
  write: false,
});
export const base = "chrome-extension://test-extension/";
export function worker(
  tab: {
    id: number;
    url: string;
    incognito?: boolean;
    windowId?: number;
  },
  fetcher?: typeof fetch,
) {
  let listener: Function;
  const local: Record<string, any> = {};
  const session: Record<string, any> = {
    bindings: { tabs: {}, lastCapture: {} },
  };
  const injected: number[] = [];
  let remote: any;
  let command: Function;
  const opened: any[] = [],
    created: any[] = [];
  let updated: Function, removed: Function, tabCreated: Function;
  const browserTabs = new Map<number, any>([[tab.id, tab]]),
    activated: any[] = [];
  const event = () => ({ addListener() {} });
  const storage = (data: Record<string, any>) => ({
    async get() {
      return structuredClone(data);
    },
    async set(value: object) {
      Object.assign(data, structuredClone(value));
    },
  });
  const chrome = {
    runtime: {
      id: "test-extension",
      getURL: (path: string) => base + path,
      onInstalled: event(),
      onStartup: event(),
      onMessage: {
        addListener(fn: Function) {
          listener = fn;
        },
      },
    },
    storage: { local: storage(local), session: storage(session) },
    tabs: {
      query: async (query: any) =>
        query?.active ? [tab] : [...browserTabs.values()],
      get: async (id: number) => {
        if (!browserTabs.has(id)) throw Error("No tab");
        return browserTabs.get(id);
      },
      update: async (id: number, options: any) => {
        if (!browserTabs.has(id)) throw Error("No tab");
        Object.assign(browserTabs.get(id), options);
        activated.push({ id, ...options });
        return browserTabs.get(id);
      },
      create: async (options: any) => {
        created.push(options);
        const next = { id: 100 + created.length, ...options };
        browserTabs.set(next.id, next);
        return next;
      },
      sendMessage: async () => ({}),
      onCreated: {
        addListener(fn: Function) {
          tabCreated = fn;
        },
      },
      onUpdated: {
        addListener(fn: Function) {
          updated = fn;
        },
      },
      onRemoved: {
        addListener(fn: Function) {
          removed = fn;
        },
      },
    },
    alarms: { onAlarm: event() },
    commands: {
      onCommand: {
        addListener(fn: Function) {
          command = fn;
        },
      },
    },
    sidePanel: {
      open: async (options: any) => {
        opened.push(options);
      },
    },
    contextMenus: { onClicked: event() },
    permissions: { contains: async () => true },
    scripting: {
      unregisterContentScripts: async () => {},
      registerContentScripts: async () => {},
      executeScript: async (options: any) => {
        injected.push(options.target.tabId);
      },
    },
  };
  runInNewContext(bundle.outputFiles[0].text, {
    chrome,
    crypto: webcrypto,
    URL,
    AbortSignal,
    TextEncoder,
    structuredClone,
    fetch:
      fetcher ??
      (async (url: string) => ({
        ok: true,
        json: async () =>
          structuredClone(
            url.endsWith("/api/sessions") ? [{ id: remote.id }] : remote,
          ),
      })),
  });
  const request = (
    type: string,
    extra: object = {},
    url = base + "index.html?workspace=1",
  ) =>
    new Promise<any>((resolve) =>
      listener(
        { type, ...extra },
        {
          id: chrome.runtime.id,
          url,
          tab: { ...tab, url },
        },
        (value: any) => resolve(structuredClone(value)),
      ),
    );
  const content = (url: string, incognito = false) =>
    new Promise<any>((resolve) =>
      listener(
        { type: "reading-context" },
        {
          id: chrome.runtime.id,
          url,
          tab: { id: 8, url, incognito, active: true },
        },
        (value: any) => resolve(structuredClone(value)),
      ),
    );
  // A message from the content script on another page, as Chrome would deliver it.
  const fromTab = (msg: object, url: string, id = 8) =>
    new Promise<any>((resolve) =>
      listener(
        msg,
        {
          id: chrome.runtime.id,
          url,
          frameId: 0,
          tab: { id, url, active: true },
        },
        (value: any) => resolve(structuredClone(value)),
      ),
    );
  return {
    request,
    content,
    fromTab,
    local,
    session,
    injected,
    opened,
    created,
    activated,
    async newTab(value: any) {
      browserTabs.set(value.id, value);
      await tabCreated(value);
    },
    async navigate(id: number, url: string) {
      const t = browserTabs.get(id);
      t.url = url;
      await updated(id, { url }, t);
      await new Promise((r) => setImmediate(r));
    },
    async closeTab(id: number) {
      browserTabs.delete(id);
      await removed(id);
      await new Promise((r) => setImmediate(r));
    },
    async command(name: string) {
      await command(name, { ...tab, windowId: 1 });
      await new Promise((r) => setImmediate(r));
    },
    setRemote(value: any) {
      remote = value;
    },
  };
}
