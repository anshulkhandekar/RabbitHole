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

test("fast analogy typing stays in a local draft and consecutive preference changes merge", async () => {
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
  const { sessionDefaults } =
    await import("../apps/extension/src/settings-model");
  const root = createRoot(document.getElementById("root")!);
  const saved: any[] = [];
  await act(async () =>
    root.render(
      React.createElement(Settings, {
        panel: false,
        connected: true,
        connectionError: false,
        backend: "",
        agentUrl: "",
        theme: "system",
        mapList: false,
        state: { newSessionDefaults: sessionDefaults() },
        onClose() {},
        onTheme() {},
        onMapList() {},
        onPreference: async (v) => {
          saved.push(v);
        },
        onSession: async () => {},
        onConnection: async () => true,
        onExport() {},
        onRebuild() {},
        onDelete() {},
        onUnexclude() {},
        onSearchOffer() {},
        scroll: { current: 0 },
      }),
    ),
  );
  const select = document.querySelector(
    '[data-section="Session"] select',
  ) as HTMLSelectElement;
  const input = [...document.querySelectorAll("label")]
    .find((l) => l.textContent?.startsWith("Analogies"))!
    .querySelector("input")!;
  await act(async () => {
    select.value = "deep";
    select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
  for (let i = 1; i <= "busy restaurant kitchens".length; i++) {
    const value = "busy restaurant kitchens".slice(0, i);
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        "value",
      )!.set!.call(input, value);
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    assert.equal(input.value, value);
  }
  assert.equal(saved.length, 1, "typing does not issue a save per character");
  await act(async () =>
    input.dispatchEvent(
      new dom.window.FocusEvent("focusout", { bubbles: true }),
    ),
  );
  assert.equal(
    saved.at(-1).newSessionDefaults.analogy,
    "busy restaurant kitchens",
  );
  assert.equal(saved.at(-1).newSessionDefaults.depth, "deep");
  await act(async () => root.unmount());
  dom.window.close();
});

for (const close of ["Escape", "backdrop", "button"] as const)
  test(`analogy draft is saved when closing with ${close}`, async () => {
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
    const { sessionDefaults } =
      await import("../apps/extension/src/settings-model");
    const root = createRoot(document.getElementById("root")!);
    const saved: any[] = [];
    await act(async () =>
      root.render(
        React.createElement(Settings, {
          panel: false,
          connected: true,
          connectionError: false,
          backend: "",
          agentUrl: "",
          theme: "system",
          mapList: false,
          state: { newSessionDefaults: sessionDefaults() },
          onClose() {},
          onTheme() {},
          onMapList() {},
          onPreference: async (v) => {
            saved.push(v);
          },
          onSession: async () => {},
          onConnection: async () => true,
          onExport() {},
          onRebuild() {},
          onDelete() {},
          onUnexclude() {},
          onSearchOffer() {},
          scroll: { current: 0 },
        }),
      ),
    );
    const select = document.querySelector(
      '[data-section="Session"] select',
    ) as HTMLSelectElement;
    const input = [...document.querySelectorAll("label")]
      .find((l) => l.textContent?.startsWith("Analogies"))!
      .querySelector("input")!;
    await act(async () => {
      select.value = "deep";
      select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    });
    for (let i = 1; i <= "busy restaurant kitchens".length; i++) {
      const value = "busy restaurant kitchens".slice(0, i);
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          dom.window.HTMLInputElement.prototype,
          "value",
        )!.set!.call(input, value);
        input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      });
      assert.equal(input.value, value);
    }
    assert.equal(saved.length, 1, "typing does not issue a save per character");
    await act(async () => {
      if (close === "Escape")
        input.dispatchEvent(
          new dom.window.KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
          }),
        );
      else if (close === "backdrop")
        (document.querySelector(".modal-backdrop") as HTMLElement).click();
      else
        (
          document.querySelector('[aria-label="Close settings"]') as HTMLElement
        ).click();
    });
    assert.equal(
      saved.at(-1).newSessionDefaults.analogy,
      "busy restaurant kitchens",
    );
    assert.equal(saved.at(-1).newSessionDefaults.depth, "deep");
    await act(async () => root.unmount());
    dom.window.close();
  });
