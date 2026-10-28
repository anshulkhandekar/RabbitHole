import { test } from "node:test";
import assert from "node:assert/strict";
import { analysis } from "./support";
import { worker, base } from "./worker-harness";

test("widget position persists and shortcuts open each view and toggle visibility without pausing collection", async () => {
  const tab = { id: 7, url: "https://research.example/article" };
  const app = worker(tab);
  const started = await app.request("start");
  const positioned = await app.request("reading-position", {
    position: { x: 0, y: 0.75 },
  });
  assert.equal(positioned.saved, true);
  assert.equal(app.local.state.widgetPosition.y, 0.75);
  const rejected = await app.request("reading-position", {
    position: { x: -1, y: 2 },
  });
  assert.ok(rejected.error);
  await app.command("open-panel");
  assert.equal(app.opened[0].windowId, 1);
  await app.command("open-workspace");
  assert.equal(app.created[0].url, base + "index.html?workspace=1#map");
  await app.command("toggle-indicator");
  assert.equal(app.local.state.readingMode, false);
  await app.command("toggle-indicator");
  assert.equal(app.local.state.readingMode, true);
  assert.equal(app.local.state.sessions[started.active].status, "active");
});

test("handoff state is shared across views and resolves only after the submitted captures are saved", async () => {
  const app = worker({ id: 7, url: base + "index.html?workspace=1" });
  const started = await app.request("start");
  const id = started.active;
  app.local.state.sessions[id].captures = [{ id: "c1" }, { id: "c2" }];
  const sent = await app.request("handoff", {
    id,
    prompt: "Process this session",
    copied: true,
    opened: true,
  });
  assert.equal(sent.handoffs[id].status, "waiting");
  const otherView = await app.request("state", {}, base + "index.html?panel=1");
  assert.equal(otherView.handoffs[id].prompt, "Process this session");
  app.local.state.config.token = "test-token";
  app.local.state.queue = [];
  app.setRemote({
    ...sent.sessions[id],
    version: 1,
    processed: ["c1"],
    analysis: analysis(),
  });
  const partial = await app.request("refresh");
  assert.equal(partial.handoffs[id].status, "waiting");
  app.setRemote({
    ...partial.sessions[id],
    version: 2,
    processed: ["c1", "c2"],
    analysis: analysis(),
  });
  const finished = await app.request("refresh");
  assert.equal(finished.handoffs[id].status, "saved");
});

test("expanded workspace starts a named session without capturing an unrelated tab", async () => {
  const app = worker({ id: 7, url: base + "index.html?workspace=1" });
  const context = await app.request("ui-context");
  assert.equal(context.canStart, true);
  const result = await app.request("start", {
    title: "System design interviews",
  });
  assert.ok(result.active, "creation succeeds even before backend setup");
  const active = result.sessions[result.active];
  assert.equal(active.title, "System design interviews");
  assert.equal(active.status, "active");
  assert.deepEqual(app.session.bindings.tabs, {});
  assert.deepEqual(app.injected, []);
  const panel = await app.request("state", {}, base + "index.html?panel=1");
  assert.equal(
    panel.active,
    active.id,
    "sidebar reads the same active session",
  );
  assert.equal(
    result.queue.find((q: any) => q.method === "POST").body.title,
    active.title,
  );
  assert.equal((await app.request("ui-context")).count, 0);
});

test("a workspace session begins capturing only after the research tab is included", async () => {
  const tab = { id: 7, url: base + "index.html?workspace=1" };
  const app = worker(tab);
  const started = await app.request("start");
  Object.assign(tab, { id: 8, url: "https://research.example/article" });
  const before = await app.request("ui-context");
  assert.equal(before.included, false);
  assert.equal(before.count, 0);
  const included = await app.request("include");
  assert.equal(included.active, started.active);
  assert.equal(app.session.bindings.tabs[8], started.active);
  assert.deepEqual(app.injected, [8]);
  assert.equal((await app.request("ui-context")).included, true);
});

test("starting another session preserves an already finished session", async () => {
  const app = worker({ id: 7, url: base + "index.html?workspace=1" });
  const first = await app.request("start");
  app.local.state.sessions[first.active].status = "finished";
  const second = await app.request("start");
  assert.notEqual(second.active, first.active);
  assert.equal(second.sessions[first.active].status, "finished");
});

test("a new Google search automatically joins an active session but unrelated, private and excluded pages do not", async () => {
  const tab = { id: 7, url: base + "index.html?workspace=1" };
  const app = worker(tab);
  const started = await app.request("start");
  const id = started.active;
  assert.equal(
    (await app.content("https://mail.example/inbox")).included,
    false,
  );
  assert.equal(app.session.bindings.tabs[8], undefined);
  assert.equal(
    await app.content("https://www.google.com/search?q=private", true),
    null,
  );
  assert.equal(
    (
      await app.content(
        "https://www.google.com.attacker.example/search?q=hello",
      )
    ).included,
    false,
  );
  assert.equal(app.session.bindings.tabs[8], undefined);
  const included = await app.content(
    "https://www.google.com/search?q=system+design",
  );
  assert.equal(included.id, id);
  assert.equal(app.session.bindings.tabs[8], id);
  Object.assign(tab, {
    id: 8,
    url: "https://www.google.com/search?q=system+design",
  });
  await app.request("exclude", {
    url: "https://www.google.com/search?q=system+design",
  });
  assert.equal(
    await app.content("https://www.google.com/search?q=system+design"),
    null,
  );
  app.local.state.sessions[id].status = "paused";
  delete app.session.bindings.tabs[8];
  assert.equal(
    (await app.content("https://www.google.com/search?q=another")).included,
    false,
  );
  assert.equal(app.session.bindings.tabs[8], undefined);
});

test("starting on a regular research page still explicitly enrolls that page", async () => {
  const app = worker({ id: 9, url: "https://research.example/article" });
  const result = await app.request("start", { title: "  Research question  " });
  assert.ok(result.active);
  assert.equal(result.sessions[result.active].title, "Research question");
  assert.equal(app.session.bindings.tabs[9], result.active);
  assert.deepEqual(app.injected, [9]);
});

test("opening the sidebar on a new search reports it included before extraction starts", async () => {
  const tab = { id: 7, url: base + "index.html?workspace=1" };
  const app = worker(tab);
  const started = await app.request("start");
  Object.assign(tab, {
    id: 8,
    url: "https://www.google.com/search?q=system+design",
  });
  const context = await app.request("ui-context");
  assert.equal(context.included, true);
  assert.equal(context.count, 1);
  assert.equal(app.session.bindings.tabs[8], started.active);
});

test("browser restart does not silently resume automatic search collection", async () => {
  const app = worker({ id: 7, url: base + "index.html?workspace=1" });
  const started = await app.request("start");
  delete app.session.bindings;
  const context = await app.content(
    "https://www.google.com/search?q=after+restart",
  );
  assert.equal(context.status, "paused");
  assert.equal(context.included, false);
  assert.equal(app.local.state.sessions[started.active].status, "paused");
  assert.equal(Object.keys(app.session.bindings.tabs).length, 0);
});

for (const tab of [
  { id: 10, url: "chrome://settings" },
  { id: 11, url: base + "index.html?workspace=1", incognito: true },
  { id: 12, url: "https://research.example", incognito: true },
]) {
  test(`starting cannot enroll restricted or private pages (${tab.id})`, async () => {
    const app = worker(tab);
    const result = await app.request("start");
    assert.match(result.error, /regular research webpage/);
    assert.deepEqual(app.injected, []);
    assert.equal(app.local.state, undefined);
  });
}

test("an unread map update keeps its dot while the next handoff is pending", async () => {
  const app = worker({ id: 7, url: base + "index.html?workspace=1" });
  const started = await app.request("start"),
    id = started.active;
  await app.request("handoff", { id, prompt: "Rebuild", intent: "rebuild" });
  app.local.state.config.token = "test-token";
  app.local.state.queue = [];
  app.setRemote({ ...started.sessions[id], version: 1, analysis: analysis() });
  await app.request("refresh");
  const next = await app.request("handoff", {
    id,
    prompt: "More questions",
    intent: "rebuild",
  });
  assert.equal(next.mapUpdated[id], 1);
  assert.equal(next.handoffs[id].status, "waiting");
});

test("a handoff includes all pending finds and leaves only later arrivals pending", async () => {
  const app = worker({ id: 7, url: base + "index.html?workspace=1" });
  const started = await app.request("start"),
    id = started.active;
  app.local.state.sessions[id].captures = Array.from({ length: 8 }, (_, i) => ({
    id: `c${i + 1}`,
  }));
  const sent = await app.request("handoff", {
    id,
    prompt: "Process all pending finds",
  });
  assert.deepEqual(sent.handoffs[id].captureIds, [
    "c1",
    "c2",
    "c3",
    "c4",
    "c5",
    "c6",
    "c7",
    "c8",
  ]);
  app.local.state.config.token = "test-token";
  app.local.state.queue = [];
  app.setRemote({
    ...sent.sessions[id],
    version: 1,
    processed: ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"],
    captures: [...sent.sessions[id].captures, { id: "c9" }],
    analysis: analysis(),
  });
  const refreshed = await app.request("refresh");
  assert.equal(refreshed.handoffs[id].status, "saved");
  assert.equal(
    refreshed.sessions[id].captures.filter(
      (c: any) => !refreshed.sessions[id].processed.includes(c.id),
    ).length,
    1,
  );
});

test("opening the side panel calls Chrome immediately before asynchronous storage work", async () => {
  const app = worker({
    id: 7,
    url: base + "index.html?workspace=1",
    windowId: 17,
  });
  const opened = app.request("open-panel");
  assert.equal(app.opened[0]?.windowId, 17);
  assert.equal((await opened).opened, true);
});

test("a new article inherits its search session before the first content scan", async () => {
  const app = worker({ id: 1, url: "https://research.example/start" });
  await app.request("start");
  await app.newTab({
    id: 3,
    url: "https://www.google.com/search?q=alloys",
    active: false,
  });
  await app.newTab({
    id: 2,
    url: "https://research.example/alloys",
    openerTabId: 3,
    active: true,
  });
  const context = await app.fromTab(
    { type: "reading-context" },
    "https://research.example/alloys",
    2,
  );
  assert.equal(context.included, true);
});

test("new article tabs never inherit collection when private or excluded", async () => {
  const app = worker({ id: 1, url: "https://research.example/start" });
  const state = await app.request("start");
  app.local.state.excluded[state.active] = ["site:blocked.example"];
  await app.newTab({
    id: 2,
    url: "https://blocked.example/article",
    openerTabId: 1,
  });
  await app.newTab({
    id: 3,
    url: "https://research.example/private",
    openerTabId: 1,
    incognito: true,
  });
  assert.equal(app.session.bindings.tabs[2], undefined);
  assert.equal(app.session.bindings.tabs[3], undefined);
});

test("following an article enrolls a new search before same-tab navigation", async () => {
  const app = worker({ id: 1, url: base + "index.html?workspace=1" });
  await app.request("start");
  const follow = await app.fromTab(
    { type: "research-follow", url: "https://research.example/article" },
    "https://www.google.com/search?q=alloys",
    8,
  );
  assert.equal(follow.included, true);
  const context = await app.fromTab(
    { type: "reading-context" },
    "https://research.example/article",
    8,
  );
  assert.equal(context.included, true);
});
