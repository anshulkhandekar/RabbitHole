import { test } from "node:test";
import assert from "node:assert/strict";
import { worker } from "./worker-harness";
const google = (q: string) =>
  "https://www.google.com/search?q=" + encodeURIComponent(q);
const search = (id: string, sessionId: string, q: string) => ({
  id,
  sessionId,
  sourceType: "search",
  url: google(q),
  title: q,
  text: q,
  timestamp: new Date().toISOString(),
  tag: "none",
  references: [],
});

test("a search with no rabbit hole offers to start one, and starting keeps the goal", async () => {
  const app = worker({ id: 7, url: "https://research.example/a" });
  const offer = await app.fromTab(
    { type: "search-offer" },
    google("how do tides work"),
  );
  assert.deepEqual(
    { kind: offer.kind, query: offer.query },
    { kind: "start", query: "how do tides work" },
  );
  assert.equal(
    await app.fromTab({ type: "search-offer" }, google("how do tides work")),
    null,
    "the same search isn't offered twice",
  );
  const accepted = await app.fromTab(
    {
      type: "search-accept",
      choice: "start",
      goal: "Why are there two tides a day?",
      familiarity: "new",
    },
    google("how do tides work"),
  );
  assert.equal(accepted.saved, true);
  const state = app.local.state,
    s = state.sessions[state.active];
  assert.equal(s.title, "how do tides work");
  assert.equal(s.goal, "Why are there two tides a day?");
  assert.equal(s.familiarity, "new");
  assert.equal(app.session.bindings.tabs["8"], s.id);
  const created = state.queue.find((q: any) => q.path === "/api/sessions");
  assert.equal(created.body.goal, "Why are there two tides a day?");
});

test("accepting needs a live offer for that exact search; not now and don't ask are respected", async () => {
  const app = worker({ id: 7, url: "https://research.example/a" });
  const forged = await app.fromTab(
    { type: "search-accept", choice: "start" },
    google("anything"),
  );
  assert.match(forged.error, /expired/);
  assert.equal(app.local.state?.active, undefined);
  await app.fromTab({ type: "search-offer" }, google("first topic"));
  await app.fromTab(
    { type: "search-accept", choice: "hush" },
    google("first topic"),
  );
  assert.equal(
    await app.fromTab({ type: "search-offer" }, google("second topic")),
    null,
  );
  // Other tabs still get offers; "Don't ask" turns them off everywhere.
  const other = await app.fromTab(
    { type: "search-offer" },
    google("third topic"),
    9,
  );
  assert.equal(other.kind, "start");
  await app.fromTab(
    { type: "search-accept", choice: "never" },
    google("third topic"),
    9,
  );
  assert.equal(
    await app.fromTab({ type: "search-offer" }, google("fourth"), 10),
    null,
  );
  assert.equal(
    await app.fromTab({ type: "search-offer" }, "https://example.org/page"),
    null,
    "only Google searches get offers",
  );
});

test("a search off the current topic offers a new rabbit hole and moves the search there", async () => {
  const app = worker({ id: 7, url: google("how do gpus work") });
  const started = await app.request("start", { title: "GPUs" });
  const old = started.active;
  app.local.state.sessions[old].captures = [
    search("c1", old, "how do gpus work"),
    search("c2", old, "what is cuda"),
  ];
  // The worker binds a fresh Google tab to the collecting session.
  await app.content(google("cuda kernels"));
  assert.equal(
    await app.fromTab({ type: "search-offer" }, google("cuda kernels")),
    null,
    "a related search stays quiet",
  );
  await app.content(google("best pasta recipes"));
  const offer = await app.fromTab(
    { type: "search-offer" },
    google("best pasta recipes"),
  );
  assert.equal(offer.kind, "switch");
  assert.equal(offer.title, "GPUs");
  app.local.state.sessions[old].captures.push(
    search("c3", old, "best pasta recipes"),
    {
      ...search("overview", old, "best pasta recipes"),
      sourceType: "google_ai_overview",
    },
    {
      ...search("processed", old, "best pasta recipes"),
      sourceType: "google_ai_overview",
    },
  );
  app.local.state.sessions[old].processed = ["processed"];
  await app.fromTab(
    { type: "search-accept", choice: "start" },
    google("best pasta recipes"),
  );
  const state = app.local.state;
  assert.notEqual(state.active, old);
  assert.equal(state.sessions[old].status, "paused");
  assert.deepEqual(
    state.sessions[old].captures.map((c: any) => c.id),
    ["c1", "c2", "processed"],
  );
  assert.deepEqual(state.sessions[old].removed, ["c3", "overview"]);
  assert.equal(state.sessions[state.active].title, "best pasta recipes");
});

test("a paused rabbit hole is offered for resuming, and adding resumes it on this tab", async () => {
  const app = worker({ id: 7, url: "https://research.example/a" });
  const { active } = await app.request("start", { title: "Tides" });
  await app.request("patch", { id: active, patch: { status: "paused" } });
  const offer = await app.fromTab(
    { type: "search-offer" },
    google("spring tides"),
  );
  assert.equal(offer.kind, "resume");
  await app.fromTab(
    { type: "search-accept", choice: "add" },
    google("spring tides"),
  );
  assert.equal(app.local.state.sessions[active].status, "active");
  assert.equal(app.session.bindings.tabs["8"], active);
});

test("finds can be hidden, retagged and deleted; uncertain uploads get a deletion tombstone", async () => {
  const app = worker({ id: 7, url: "https://research.example/a" });
  const { active } = await app.request("start", { title: "Tides" });
  const s = app.local.state.sessions[active];
  s.captures = [
    {
      ...search("c1", active, "tides"),
      sourceType: "article",
      url: "https://shop.example/a",
    },
    search("c2", active, "moon"),
  ];
  app.local.state.queue.push({
    id: "q-c2",
    method: "POST",
    path: `/api/sessions/${active}/captures`,
    body: s.captures[1],
  });
  let state = await app.request("capture-hide", {
    id: active,
    captureId: "c1",
    hidden: true,
  });
  assert.deepEqual([...state.sessions[active].hidden], ["c1"]);
  assert.ok(
    state.queue.some(
      (q: any) =>
        q.method === "PATCH" &&
        q.path.endsWith("/captures/c1") &&
        q.body.hidden === true,
    ),
  );
  state = await app.request("capture-tag", {
    id: active,
    captureId: "c1",
    tag: "confusing",
  });
  assert.equal(state.sessions[active].captures[0].tag, "confusing");
  state = await app.request("capture-delete", { id: active, captureId: "c2" });
  assert.deepEqual(
    state.sessions[active].captures.map((c: any) => c.id),
    ["c1"],
  );
  assert.ok(!state.queue.some((q: any) => q.body?.id === "c2"));
  assert.ok(
    state.queue.some(
      (q: any) => q.method === "DELETE" && q.path.endsWith("/captures/c2"),
    ),
  );
  state = await app.request("capture-delete", { id: active, captureId: "c1" });
  assert.ok(
    state.queue.some(
      (q: any) => q.method === "DELETE" && q.path.endsWith("/captures/c1"),
    ),
  );
  assert.ok(
    !state.queue.some(
      (q: any) => q.path.endsWith("/captures/c1") && q.method === "PATCH",
    ),
  );
  state = await app.request("exclude-site", { url: "https://shop.example/a" });
  assert.deepEqual([...state.excluded[active]], ["site:shop.example"]);
  assert.equal(
    await app.content("https://shop.example/other-page"),
    null,
    "every page on an excluded site is ignored",
  );
});

test("a Google tab bound to an existing rabbit hole is not silently rebound", async () => {
  const url = google("old topic");
  const app = worker({ id: 7, url });
  const first = (await app.request("start", { title: "First" })).active;
  await app.content(url);
  const second = (await app.request("start", { title: "Second" })).active;
  assert.notEqual(first, second);
  await app.content(url);
  assert.equal(app.session.bindings.tabs[8], first);
  const offer = await app.fromTab({ type: "search-offer" }, url);
  assert.equal(offer.kind, "add");
  await app.fromTab({ type: "search-accept", choice: "add" }, url);
  assert.equal(app.session.bindings.tabs[8], second);
});
