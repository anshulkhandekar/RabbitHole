import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Store } from "../apps/server/src/store";
import { createApp } from "../apps/server/src/app";
import { analysis, capture } from "./support";
import { worker } from "./worker-harness";

test("a v1 review after Go saves v2 stays local and later captures sync", async () => {
  const store = new Store(":memory:");
  const server = createServer(
    createApp(store, [{ owner: "o", token: "tok" }]),
  ).listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const app = worker({ id: 7, url: "https://example.org/gpu" }, fetch);
    await app.request("config", {
      config: {
        backend: `http://localhost:${(server.address() as any).port}`,
        token: "tok",
        agentUrl: "https://go.superhuman.com",
      },
    });
    const id = (await app.request("start", { title: "Research" })).active;
    store.capture("o", id, { ...capture(), sessionId: id });
    const v1 = { ...analysis(), sessionId: id };
    store.save("o", v1);
    await app.request("refresh");
    store.save("o", {
      ...v1,
      expectedVersion: 1,
      intent: "rebuild",
      processedCaptureIds: [],
    });
    await app.request("review", {
      id,
      attempt: {
        id: "a1",
        studyId: "q1",
        analysisVersion: 1,
        response: "",
        rating: "understood",
        choice: 1,
        timestamp: new Date().toISOString(),
      },
    });
    await app.fromTab(
      {
        type: "capture",
        capture: { ...capture("c2", "Later evidence"), sessionId: id },
      },
      "https://example.org/gpu",
      7,
    );
    const state = await app.request("refresh");
    assert.ok(store.get("o", id).captures.some((c) => c.id === "c2"));
    assert.equal(state.queue.length, 0);
    assert.equal(state.sessions[id].attempts[0].id, "a1");
    assert.equal(state.sessions[id].attempts[0].localOnly, true);
    assert.equal(store.get("o", id).attempts.length, 0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.db.close();
  }
});

test("a successful refresh retains a queue failure until the queue can sync", async () => {
  let failing = false;
  const remote: any = {
    id: "remote",
    version: 0,
    captures: [],
    attempts: [],
    processed: [],
  };
  const app = worker({ id: 7, url: "https://example.org/gpu" }, (async (
    _url: any,
    options: any,
  ) => ({
    ok: options.method ? !failing : true,
    status: options.method && failing ? 503 : 200,
    json: async () =>
      String(_url).endsWith("/api/sessions") ? [{ id: remote.id }] : remote,
  })) as typeof fetch);
  await app.request("config", {
    config: {
      backend: "http://localhost:3210",
      agentUrl: "https://go.superhuman.com",
      token: "tok",
    },
  });
  const id = (await app.request("start", { title: "Research" })).active;
  failing = true;
  await app.request("patch", { id, patch: { title: "New title" } });
  const state = await app.request("refresh");
  assert.ok(state.queue.length);
  assert.match(state.error, /503/);
  failing = false;
  assert.equal((await app.request("refresh")).error, undefined);
});

test("review retries upsert one local attempt and never send localOnly metadata", async () => {
  const bodies: any[] = [];
  const app = worker({ id: 7, url: "https://example.org/gpu" }, (async (
    _url: any,
    options: any,
  ) => {
    if (String(_url).endsWith("/reviews"))
      bodies.push(JSON.parse(options.body));
    return { ok: true };
  }) as typeof fetch);
  const id = (await app.request("start", { title: "Test" })).active;
  app.local.state.sessions[id].version = 1;
  const a = {
    id: "once",
    studyId: "q1",
    analysisVersion: 1,
    rating: "understood",
    response: "",
    timestamp: new Date().toISOString(),
  };
  await app.request("review", { id, attempt: a });
  await app.request("review", { id, attempt: a });
  assert.equal(app.local.state.sessions[id].attempts.length, 1);
  app.local.state.config.token = "tok";
  await app.request("refresh");
  assert.equal(bodies.length, 1);
  assert.equal("localOnly" in bodies[0], false);
});

test("a checked answer is durable before a slow review POST completes", async () => {
  let release!: () => void;
  const response = new Promise<void>((r) => {
    release = r;
  });
  const app = worker({ id: 7, url: "https://example.org/gpu" }, (async (
    url: any,
  ) => {
    if (String(url).endsWith("/reviews")) await response;
    return { ok: true };
  }) as typeof fetch);
  const id = (await app.request("start", { title: "Test" })).active;
  app.local.state.sessions[id].version = 1;
  app.local.state.config.token = "tok";
  await app.request("patch", { id, patch: { title: "Ready" } });
  const pending = app.request("review", {
    id,
    attempt: {
      id: "durable",
      studyId: "q1",
      analysisVersion: 1,
      rating: "understood",
      response: "",
      timestamp: new Date().toISOString(),
    },
  });
  try {
    await new Promise((r) => setImmediate(r));
    assert.equal(app.local.state.sessions[id].attempts.length, 1);
    assert.ok(
      app.local.state.queue.some((q: any) => q.path.endsWith("/reviews")),
    );
  } finally {
    release();
    await pending;
  }
});

test("reasoning added after an immediate check updates the same server attempt", async () => {
  const store = new Store(":memory:");
  const server = createServer(
    createApp(store, [{ owner: "o", token: "tok" }]),
  ).listen(0);
  await new Promise<void>((r) => server.once("listening", r));
  try {
    const app = worker({ id: 7, url: "https://example.org/gpu" }, fetch);
    await app.request("config", {
      config: {
        backend: `http://localhost:${(server.address() as any).port}`,
        token: "tok",
        agentUrl: "https://go.superhuman.com",
      },
    });
    const id = (await app.request("start", { title: "Test" })).active;
    store.capture("o", id, { ...capture(), sessionId: id });
    store.save("o", { ...analysis(), sessionId: id });
    await app.request("refresh");
    const attempt = {
      id: "noted",
      studyId: "q1",
      analysisVersion: 1,
      response: "Sequential only",
      choice: 0,
      rating: "again",
      timestamp: new Date().toISOString(),
    };
    await app.request("review", { id, attempt });
    await app.request("review", {
      id,
      attempt: { ...attempt, note: "I confused the two execution models." },
    });
    assert.equal(store.get("o", id).attempts.length, 1);
    assert.equal(
      store.get("o", id).attempts[0].note,
      "I confused the two execution models.",
    );
    assert.throws(
      () =>
        store.review("o", id, {
          ...attempt,
          choice: 1,
          rating: "understood",
          response: "Parallel execution",
          note: "changed grade",
        }),
      /different answer/,
    );
    store.save("o", {
      ...analysis(),
      sessionId: id,
      expectedVersion: 1,
      intent: "rebuild",
      processedCaptureIds: [],
    });
    await app.request("review", {
      id,
      attempt: { ...attempt, note: "Later reasoning after Go saved" },
    });
    const after = await app.request("refresh");
    assert.equal(after.queue.length, 0);
    assert.equal(
      after.sessions[id].attempts[0].localOnly,
      undefined,
      "a rejected note update does not reclassify a previously synced answer",
    );
    assert.equal(
      after.sessions[id].attempts[0].note,
      "Later reasoning after Go saved",
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    store.db.close();
  }
});

test("refresh recognizes an already accepted server attempt after an uncertain stale retry", async () => {
  let remote: any;
  const app = worker({ id: 7, url: "https://example.org/gpu" }, (async (
    url: any,
    options: any,
  ) => ({
    ok: !String(url).endsWith("/reviews"),
    status: String(url).endsWith("/reviews") ? 409 : 200,
    json: async () =>
      String(url).endsWith("/api/sessions") ? [{ id: remote.id }] : remote,
  })) as typeof fetch);
  const id = (await app.request("start", { title: "Test" })).active;
  app.local.state.sessions[id].version = 1;
  const attempt = {
    id: "accepted",
    studyId: "q1",
    analysisVersion: 1,
    rating: "understood",
    response: "",
    timestamp: new Date().toISOString(),
  };
  await app.request("review", { id, attempt });
  remote = { ...app.local.state.sessions[id], version: 2, attempts: [attempt] };
  app.local.state.config.token = "tok";
  const state = await app.request("refresh");
  assert.equal(state.queue.length, 0);
  assert.equal(state.sessions[id].attempts.length, 1);
  assert.equal(
    state.sessions[id].attempts[0].localOnly,
    undefined,
    "a confirmed server copy is not a local-only answer",
  );
});
