import { test } from "node:test";
import assert from "node:assert/strict";
import { worker, base } from "./worker-harness";
test("new-session defaults are copied into both the local session and server create payload", async () => {
  const app = worker({ id: 7, url: base + "index.html?workspace=1" });
  await app.request("preferences", {
    newSessionDefaults: {
      depth: "deep",
      analogy: "gardening",
      activities: ["quiz"],
      articleCapture: false,
      autoHighlights: true,
    },
    practicePreferences: {
      roundSize: 12,
      confidence: false,
      harderOffers: false,
    },
    goCompletion: "quiet",
  });
  const state = await app.request("start");
  const s = state.sessions[state.active];
  assert.equal(s.settings.depth, "deep");
  assert.equal(s.settings.articleCapture, false);
  assert.equal(
    state.queue.find((q: any) => q.method === "POST").body.settings.analogy,
    "gardening",
  );
  assert.equal(state.practicePreferences.roundSize, 12);
  assert.equal(state.goCompletion, "quiet");
});
test("practice offer dismissals survive a server refresh without changing server-owned settings", async () => {
  const app = worker({ id: 7, url: base + "index.html?workspace=1" });
  const start = await app.request("start");
  const id = start.active;
  await app.request("practice-state", {
    id,
    practice: { dismissedHarder: ["n1"] },
  });
  app.local.state.config.token = "test-token";
  app.local.state.queue = [];
  app.setRemote({ ...start.sessions[id], version: 1 });
  const refreshed = await app.request("refresh");
  assert.deepEqual(refreshed.sessions[id].practice.dismissedHarder, ["n1"]);
});

test("settings navigation follows the section at the scrolling page's top", async () => {
  const { sectionAt } = await import("../apps/extension/src/settings-model");
  const positions = [
    { id: "Appearance", top: 0 },
    { id: "Collection", top: 240 },
    { id: "Practice", top: 600 },
  ];
  assert.equal(sectionAt(positions, 0), "Appearance");
  assert.equal(sectionAt(positions, 250), "Collection");
  assert.equal(sectionAt(positions, 900), "Practice");
});
