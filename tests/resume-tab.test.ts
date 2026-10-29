import { test } from "node:test";
import assert from "node:assert/strict";
import { worker } from "./worker-harness";

test("sidebar resume offers the current unincluded tab without collecting it until acceptance", async () => {
  const url = "https://research.example/article",
    app = worker({ id: 7, url });
  const id = (await app.request("start")).active;
  await app.request("patch", { id, patch: { status: "paused" } });
  delete app.session.bindings.tabs[7];
  app.sent.length = 0;
  await app.request("patch", { id, patch: { status: "active" } });
  assert.equal(app.session.bindings.tabs[7], undefined);
  assert.ok(app.injected.includes(7));
  assert.ok(app.sent.some((s) => s.id === 7 && s.message.promptInclude));
  assert.equal(
    (await app.fromTab({ type: "reading-context" }, url, 7)).included,
    false,
  );
  await app.fromTab({ type: "reading-include", sessionId: id }, url, 7);
  assert.equal(app.session.bindings.tabs[7], id);
  assert.ok(app.sent.some((s) => s.id === 7 && s.message.rescan));
});

test("resuming an included tab requests a rescan without an inclusion prompt", async () => {
  const app = worker({ id: 7, url: "https://research.example/article" });
  const id = (await app.request("start")).active;
  await app.request("patch", { id, patch: { status: "paused" } });
  app.sent.length = 0;
  await app.request("patch", { id, patch: { status: "active" } });
  assert.ok(app.sent.some((s) => s.id === 7 && s.message.rescan));
  assert.ok(!app.sent.some((s) => s.message.promptInclude));
});

test("page inclusion rejects a stale session or excluded page", async () => {
  const url = "https://research.example/article",
    app = worker({ id: 7, url });
  const id = (await app.request("start")).active;
  delete app.session.bindings.tabs[7];
  assert.match(
    (await app.fromTab({ type: "reading-include", sessionId: "old" }, url, 7))
      .error,
    /active session/i,
  );
  await app.request("exclude", { url });
  assert.match(
    (await app.fromTab({ type: "reading-include", sessionId: id }, url, 7))
      .error,
    /excluded/i,
  );
  assert.equal(app.session.bindings.tabs[7], undefined);
});
