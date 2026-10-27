import { runInNewContext } from "node:vm";
import { webcrypto } from "node:crypto";
import { build } from "esbuild";

const bundle = await build({
  entryPoints: ["apps/extension/src/background.ts"],
  bundle: true,
  write: false,
});
export const base = "chrome-extension://test-extension/";
export function worker(tab: { id: number; url: string; incognito?: boolean }) {
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
      query: async () => [tab],
      create: async (options: any) => {
        created.push(options);
      },
      sendMessage: async () => ({}),
      onCreated: event(),
      onRemoved: event(),
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
    fetch: async (url: string) => ({
      ok: true,
      json: async () =>
        structuredClone(
          url.endsWith("/api/sessions") ? [{ id: remote.id }] : remote,
        ),
    }),
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
        resolve,
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
        resolve,
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
        resolve,
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
    async command(name: string) {
      await command(name, { ...tab, windowId: 1 });
      await new Promise((r) => setImmediate(r));
    },
    setRemote(value: any) {
      remote = value;
    },
  };
}
