import { test } from "node:test";
import assert from "node:assert/strict";
import { worker, base } from "./worker-harness";
test("each rabbit hole learns and reuses its Go task URL, even after closing the tab", async () => {
  const app = worker({ id: 7, url: base + "index.html?workspace=1" }),
    state = await app.request("start"),
    id = state.active;
  await app.request("go-open", { id });
  assert.equal(app.created.length, 1);
  const task =
    "https://go.superhuman.com/tasks/00000000-0000-4000-8000-000000000001";
  await app.navigate(101, task);
  await app.navigate(101, "https://go.superhuman.com/tasks/another-chat");
  await app.request("go-open", { id });
  assert.equal(app.activated.at(-1).url, task);
  await app.request("go-open", { id });
  assert.equal(app.created.length, 1);
  assert.equal(app.activated.at(-1).id, 101);
  await app.closeTab(101);
  await app.request("go-open", { id });
  assert.equal(app.created.at(-1).url, task);
  const second = await app.request("start");
  await app.request("go-open", { id: second.active });
  assert.equal(app.created.at(-1).url, "https://go.superhuman.com");
  assert.equal(app.local.state.goChats[id].url, task);
});
test("an existing conversation can be linked explicitly, and unrelated URLs are rejected", async () => {
  const app = worker({ id: 7, url: base + "index.html?workspace=1" }),
    state = await app.request("start"),
    id = state.active;
  const task =
    "https://go.superhuman.com/tasks/00000000-0000-4000-8000-000000000001";
  assert.equal(
    (
      await app.request("go-chat", {
        id,
        url: "https://evil.example/tasks/abc",
      })
    ).error?.includes("Go"),
    true,
  );
  await app.request("go-chat", { id, url: task });
  await app.request("go-open", { id });
  assert.equal(app.created[0].url, task);
});

test("changing the configured agent cannot attach the previous agent's conversation", async () => {
  const app = worker({ id: 7, url: base + "index.html?workspace=1" }),
    state = await app.request("start"),
    id = state.active;
  await app.request("go-open", { id });
  await app.navigate(101, "https://go.superhuman.com/tasks/old-agent-chat");
  app.local.state.config.agentUrl =
    "https://go.superhuman.com/agents/new-agent";
  await app.request("go-open", { id });
  assert.equal(
    app.created.at(-1).url,
    "https://go.superhuman.com/agents/new-agent",
  );
  assert.equal(app.local.state.goChats[id], undefined);
});
