import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";

import { JSDOM } from "jsdom";
import { Settings } from "../apps/extension/src/Settings";
test("connection editor never populates saved token and sends no replacement until explicitly entered", async () => {
  const dom = new JSDOM('<div id="root"></div>');
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
    matchMedia: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
  });
  dom.window.HTMLElement.prototype.scrollTo = () => {};
  const { createRoot } = await import("react-dom/client");
  const root = createRoot(document.getElementById("root")!);
  let submitted: any;
  await act(async () =>
    root.render(
      React.createElement(Settings, {
        panel: false,
        connected: true,
        connectionError: false,
        backend: "http://localhost:3210",
        agentUrl: "https://go.example",
        theme: "system",
        mapList: false,
        state: {},
        onClose() {},
        onTheme() {},
        onMapList() {},
        onPreference: async () => {},
        onSession: async () => {},
        onConnection: async (v) => {
          submitted = v;
          return true;
        },
        onExport() {},
        onRebuild() {},
        onDelete() {},
        onUnexclude() {},
        onSearchOffer() {},
        scroll: { current: 0 },
        initialSection: "Connection",
      }),
    ),
  );
  const click = async (text: string) =>
    act(async () => {
      [...document.querySelectorAll("button")]
        .find((b) => b.textContent === text)!
        .click();
    });
  await click("Change connection…");
  assert.equal(document.querySelector('input[type="password"]'), null);
  await click("Save connection");
  assert.equal(submitted.token, undefined);
  await click("Change connection…");
  await click("Replace");
  assert.equal(
    (document.querySelector('input[type="password"]') as HTMLInputElement)
      .value,
    "",
  );
  await act(async () => root.unmount());
  dom.window.close();
});
