import { test } from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { Trail } from "../apps/extension/src/Trail";
import { worker, base } from "./worker-harness";
import { capture } from "./support";

test("a saved source opened from a resumed trail joins that session before capture", async () => {
  const tab = { id: 7, url: "https://research.example/article" };
  const app = worker(tab);
  const id = (await app.request("start")).active;
  await app.fromTab(
    {
      type: "capture",
      capture: { ...capture("saved"), sessionId: id, url: tab.url },
    },
    tab.url,
    7,
  );
  delete app.session.bindings;
  await app.request("state");
  tab.url = base + "index.html?workspace=1";
  await app.request("patch", { id, patch: { status: "active" } });
  const dom = new JSDOM('<div id="root"></div>', { url: base + "index.html" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    IS_REACT_ACT_ENVIRONMENT: true,
    chrome: {
      runtime: { sendMessage: (msg: any) => app.request(msg.type, msg) },
    },
  });
  const root = createRoot(document.getElementById("root")!);
  try {
    await act(async () =>
      root.render(
        React.createElement(Trail, { session: app.local.state.sessions[id] }),
      ),
    );
    const link = document.querySelector<HTMLAnchorElement>(".stop-title")!;
    await act(async () => {
      link.dispatchEvent(
        new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }),
      );
      await new Promise((resolve) => setImmediate(resolve));
    });
    assert.equal(
      app.created.length,
      1,
      "source clicks must open through the worker",
    );
    assert.equal(app.created[0].url, "https://research.example/article");
    const context = await app.fromTab(
      { type: "reading-context" },
      "https://research.example/article",
      101,
    );
    assert.equal(context.included, true);
    assert.equal(context.id, id);
    assert.equal(
      (
        await app.fromTab(
          { type: "reading-context" },
          "https://unrelated.example/",
          202,
        )
      ).included,
      false,
    );
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
  }
});

test("opening a paused session's source remembers its tab without starting collection", async () => {
  const url = "https://research.example/article",
    app = worker({ id: 7, url });
  const id = (await app.request("start")).active;
  await app.fromTab(
    { type: "capture", capture: { ...capture("saved"), sessionId: id, url } },
    url,
    7,
  );
  await app.request("patch", { id, patch: { status: "paused" } });
  const paused = await app.request("open-source", {
    sessionId: id,
    captureId: "saved",
  });
  assert.equal(paused.opened, true);
  assert.equal(app.session.bindings.tabs[101], id);
  assert.equal(app.local.state.sessions[id].status, "paused");
  assert.equal(
    (
      await app.fromTab(
        {
          type: "capture",
          capture: { ...capture("while-paused"), sessionId: id, url },
        },
        url,
        101,
      )
    ).ignored,
    true,
  );
  await app.request("patch", { id, patch: { status: "active" } });
  await app.request("exclude-site", { url });
  const excluded = await app.request("open-source", {
    sessionId: id,
    captureId: "saved",
  });
  assert.equal(excluded.opened, true);
  assert.equal(app.session.bindings.tabs[102], undefined);
  assert.ok(
    (
      await app.fromTab(
        { type: "open-source", sessionId: id, captureId: "saved" },
        url,
        7,
      )
    ).error,
  );
  assert.ok(
    (await app.request("open-source", { sessionId: id, captureId: "missing" }))
      .error,
  );
});

test("resuming on an existing saved source includes it without asking again", async () => {
  const tab = { id: 7, url: "https://research.example/article" };
  const app = worker(tab);
  const id = (await app.request("start")).active;
  await app.fromTab(
    {
      type: "capture",
      capture: { ...capture("saved"), sessionId: id, url: tab.url },
    },
    tab.url,
    7,
  );
  delete app.session.bindings;
  await app.request("state");
  await app.request("patch", { id, patch: { status: "active" } });
  assert.equal(app.session.bindings.tabs[7], id);
  assert.equal(
    app.sent.find((sent) => sent.id === 7 && sent.message.sessionId === id)
      ?.message.promptInclude,
    false,
  );
  assert.equal(
    (await app.fromTab({ type: "reading-context" }, tab.url, 7)).included,
    true,
  );
});
