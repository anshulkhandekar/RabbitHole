import { test } from "node:test";
import assert from "node:assert/strict";
import { recentSessions } from "../apps/extension/src/ui-model";
import { worker } from "./worker-harness";
import type { Session } from "../packages/contracts/src/index";

test("session previews sort by use or update while retaining their original start dates", () => {
  const sessions = [
    {
      id: "old",
      createdAt: "2020-01-01T12:00:00Z",
      updatedAt: "2026-10-29T12:00:00Z",
    },
    {
      id: "new",
      createdAt: "2025-01-01T12:00:00Z",
      updatedAt: "2026-10-29T13:00:00Z",
    },
  ] as Session[];
  const before = structuredClone(sessions);
  assert.deepEqual(
    recentSessions(sessions).map((s) => s.id),
    ["new", "old"],
  );
  assert.deepEqual(
    recentSessions(sessions, { old: "2026-10-29T14:00:00Z" }).map((s) => s.id),
    ["old", "new"],
  );
  assert.deepEqual(sessions, before);
});

test("reopening a session records browser-local recency without changing its start date or posting it", async () => {
  const app = worker({ id: 7, url: "https://research.example/article" });
  const first = await app.request("start"),
    second = await app.request("start");
  app.local.state.sessions[first.active].createdAt = "2020-01-01T12:00:00Z";
  const state = await app.request("select", { id: first.active });
  assert.ok(state.sessionLastUsed[first.active]);
  assert.ok(
    Date.parse(state.sessionLastUsed[first.active]) >
      Date.parse(state.sessionLastUsed[second.active]),
    "rapid selections have a stable recency order even within one millisecond",
  );
  assert.equal(state.sessions[first.active].createdAt, "2020-01-01T12:00:00Z");
  assert.equal(
    recentSessions(Object.values(state.sessions), state.sessionLastUsed)[0].id,
    first.active,
  );
  assert.ok(!state.queue.some((q: any) => q.body?.sessionLastUsed));
  assert.equal(state.sessions[second.active].status, "paused");
});

test("refresh retains the original local start when the server first received an offline session later", async () => {
  const app = worker({ id: 7, url: "https://research.example/article" });
  const start = await app.request("start"),
    id = start.active;
  app.local.state.sessions[id].createdAt = "2020-01-01T12:00:00Z";
  app.local.state.config.token = "test-token";
  app.local.state.queue = [];
  app.setRemote({ ...start.sessions[id], createdAt: "2026-10-29T12:00:00Z" });
  const refreshed = await app.request("refresh");
  assert.equal(refreshed.sessions[id].createdAt, "2020-01-01T12:00:00Z");
});
