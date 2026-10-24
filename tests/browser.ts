import { createServer } from "node:http";
import { chromium } from "@playwright/test";
import { createApp } from "../apps/server/src/app";
import { Store } from "../apps/server/src/store";
import { analysis } from "./support";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  cpSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
const store = new Store(":memory:"),
  token = "browser-test-only-" + "x".repeat(40);
let backendAvailable = true;
const app = createApp(store, [{ owner: "test", token }]);
const server = createServer((req, res) => {
  if (!backendAvailable) {
    res.writeHead(503);
    res.end();
  } else app(req, res);
}).listen(0, "127.0.0.1");
await new Promise<void>((r) => server.once("listening", r));
const port = (server.address() as { port: number }).port;
const profile = mkdtempSync(tmpdir() + "/rabbithole-browser-");
const testExtension = profile + "/extension";
cpSync(resolve("dist/extension"), testExtension, { recursive: true });
const manifest = JSON.parse(
  readFileSync(testExtension + "/manifest.json", "utf8"),
);
manifest.host_permissions = ["http://*/*", "https://*/*"];
writeFileSync(testExtension + "/manifest.json", JSON.stringify(manifest));
const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
  args: [
    `--disable-extensions-except=${testExtension}`,
    `--load-extension=${testExtension}`,
  ],
});
const failures: string[] = [];
context.on("page", (p) => p.on("pageerror", (e) => failures.push(e.message)));
try {
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));
  const extensionId = new URL(worker.url()).host;
  const ui = await context.newPage();
  await ui.goto(`chrome-extension://${extensionId}/index.html`);
  await ui.getByRole("button", { name: "Connect your backend & Go" }).click();
  await ui
    .getByLabel("Backend URL", { exact: true })
    .fill(`http://127.0.0.1:${port}`);
  await ui.getByLabel("Personal bearer token").fill(token);
  // Grant website access through the extension UI; Chrome headless has no native permission bubble.
  await ui.getByRole("button", { name: "Save connection" }).click();
  await ui
    .getByRole("button", { name: "Start on your current tab →" })
    .waitFor();
  const research = await context.newPage();
  await research.route("https://www.google.com/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<html><head><title>GPU research — test fixture</title></head><body><main><h1>GPU research</h1><p>Search fixture only.</p></main></body></html>",
    }),
  );
  await research.goto("https://www.google.com/search?q=How+GPUs+work");
  await research.bringToFront();
  // Send from an actual trusted extension page while keeping research as the active tab.
  const start = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "start" }),
  );
  assert.ok(!start.error, JSON.stringify(start));
  const sessionId = start.active as string;
  await research.waitForTimeout(1800);
  let state = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "state" }),
  );
  assert.equal(state.sessions[sessionId].captures[0]?.sourceType, "search");
  await research.route("https://research.example/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: `<html><head><title>Parallel computing — test fixture</title></head><body><article><h1>How parallel execution works</h1><p id="passage">${"A GPU uses parallel execution to process many operations at once. ".repeat(14)}</p><p>Independent operations can run together. This is synthetic test material.</p></article><input value="DO NOT CAPTURE PASSWORD"><div contenteditable="true">DO NOT CAPTURE EDITABLE TEXT</div></body></html>`,
    }),
  );
  await research.goto("https://research.example/article");
  await research.waitForTimeout(2300);
  state = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "state" }),
  );
  assert.ok(
    state.sessions[sessionId].captures.some(
      (c: any) => c.sourceType === "article",
    ),
  );
  assert.ok(
    state.sessions[sessionId].captures.every(
      (c: any) => !c.text.includes("DO NOT CAPTURE"),
    ),
  );
  await research.evaluate(() => {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector("#passage")!);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
  });
  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    await chrome.tabs.sendMessage(tab.id!, { type: "highlight" });
  });
  state = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "state" }),
  );
  assert.ok(
    state.sessions[sessionId].captures.some(
      (c: any) => c.sourceType === "highlight",
    ),
  );
  const before = state.sessions[sessionId].captures.length;
  await ui.evaluate(
    (id) =>
      chrome.runtime.sendMessage({
        type: "patch",
        id,
        patch: { status: "paused" },
      }),
    sessionId,
  );
  await research.goto("https://www.google.com/search?q=Paused+search");
  await research.waitForTimeout(1700);
  state = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "state" }),
  );
  assert.equal(state.sessions[sessionId].captures.length, before);
  await ui.evaluate(
    (id) =>
      chrome.runtime.sendMessage({
        type: "patch",
        id,
        patch: { status: "active" },
      }),
    sessionId,
  );
  await ui.bringToFront();
  const unrelated = await context.newPage();
  await unrelated.route("https://www.google.com/**", (r) =>
    r.fulfill({ body: "<h1>Unrelated search</h1>", contentType: "text/html" }),
  );
  await unrelated.goto("https://www.google.com/search?q=Unrelated");
  await unrelated.waitForTimeout(1800);
  state = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "state" }),
  );
  assert.ok(
    !state.sessions[sessionId].captures.some(
      (c: any) => c.text === "Unrelated",
    ),
  );
  await ui.evaluate(() => chrome.runtime.sendMessage({ type: "include" }));
  await unrelated.waitForTimeout(1800);
  state = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "state" }),
  );
  assert.ok(
    state.sessions[sessionId].captures.some((c: any) => c.text === "Unrelated"),
  );
  await ui.evaluate(() => chrome.runtime.sendMessage({ type: "refresh" }));
  const fixture = analysis();
  fixture.sessionId = sessionId;
  fixture.processedCaptureIds = store
    .get("test", sessionId)
    .captures.map((c) => c.id);
  const evidence = fixture.processedCaptureIds.find(
    (id) =>
      store.get("test", sessionId).captures.find((c) => c.id === id)
        ?.sourceType === "article",
  )!;
  fixture.concepts.forEach((c) => (c.captureIds = [evidence]));
  fixture.edges.forEach((c) => (c.captureIds = [evidence]));
  fixture.studyItems.forEach((c) => (c.captureIds = [evidence]));
  fixture.title = "SYNTHETIC UI TEST · Parallel computing";
  store.save("test", fixture);
  await ui.bringToFront();
  await ui.getByRole("button", { name: "Sync & check Go" }).click();
  await ui.getByRole("heading", { name: fixture.title }).waitFor();
  await ui.getByRole("button", { name: "List view", exact: true }).click();
  await ui
    .getByRole("button", { name: "GPU A processor", exact: false })
    .click();
  await ui.getByText("BACK TO THE SOURCE", { exact: true }).waitFor();
  await ui.screenshot({ path: "docs/workspace-test.png", fullPage: true });
  await ui.getByRole("button", { name: "Practice", exact: false }).click();
  await ui
    .getByLabel("Your explanation")
    .fill("It runs independent operations at once.");
  await ui.getByRole("button", { name: "Reveal model explanation" }).click();
  await ui.getByRole("button", { name: "Understood", exact: true }).click();
  await ui.getByText("✓ Progress saved", { exact: false }).waitFor();
  await ui.getByRole("button", { name: "Short quiz", exact: true }).click();
  await ui.getByRole("button", { name: "B. Parallel execution" }).click();
  await ui.getByRole("button", { name: "Check answer" }).click();
  await ui.getByText("CORRECT", { exact: true }).waitFor();
  await ui.getByRole("button", { name: "Flashcards", exact: true }).click();
  await ui.getByRole("button", { name: "Reveal model explanation" }).click();
  await ui.reload();
  await ui.getByRole("heading", { name: fixture.title }).waitFor();
  assert.equal(store.get("test", sessionId).attempts.length, 1);
  await ui.setViewportSize({ width: 380, height: 850 });
  await ui.screenshot({ path: "docs/sidebar-test.png", fullPage: true });
  // Interrupt delivery, then restart the entire browser profile with a queued review.
  backendAvailable = false;
  const queued = await ui.evaluate(
    ({ id }) =>
      chrome.runtime.sendMessage({
        type: "review",
        id,
        attempt: {
          id: "offline-review",
          studyId: "q1",
          analysisVersion: 1,
          response: "offline test",
          rating: "again",
          choice: 0,
          timestamp: new Date().toISOString(),
        },
      }),
    { id: sessionId },
  );
  assert.ok(queued.queue.length > 0);
  assert.equal(store.get("test", sessionId).attempts.length, 1);
  await context.close();
  const restored = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    args: [
      `--disable-extensions-except=${testExtension}`,
      `--load-extension=${testExtension}`,
    ],
  });
  try {
    const recovered = await restored.newPage();
    await recovered.goto(`chrome-extension://${extensionId}/index.html`);
    const beforeRetry = await recovered.evaluate(() =>
      chrome.runtime.sendMessage({ type: "state" }),
    );
    assert.ok(beforeRetry.queue.length > 0);
    assert.equal(beforeRetry.sessions[sessionId].attempts.length, 2);
    backendAvailable = true;
    const synced = await recovered.evaluate(() =>
      chrome.runtime.sendMessage({ type: "refresh" }),
    );
    assert.equal(synced.queue.length, 0);
    assert.equal(store.get("test", sessionId).attempts.length, 2);
    // Offline deletion removes pending writes and cannot be resurrected by refresh.
    backendAvailable = false;
    const deleted = await recovered.evaluate(
      (id) => chrome.runtime.sendMessage({ type: "delete", id }),
      sessionId,
    );
    assert.equal(deleted.sessions[sessionId], undefined);
    backendAvailable = true;
    const afterDelete = await recovered.evaluate(() =>
      chrome.runtime.sendMessage({ type: "refresh" }),
    );
    assert.equal(afterDelete.sessions[sessionId], undefined);
    assert.throws(() => store.get("test", sessionId), /not found/);
  } finally {
    await restored.close();
  }
  assert.deepEqual(failures, []);
  console.log(
    "PASS packaged Chrome extension: pregranted website permissions (native prompt untested), automatic search/article capture, input exclusion, highlight, pause, unrelated tab exclusion, explicit include, authenticated sync, persisted fixture display, evidence, recall progress, quiz, flashcard, reload, narrow layout, interrupted delivery, browser profile restart with queued review, retry, and offline deletion without resurrection. Go generation NOT exercised.",
  );
} finally {
  await context.close();
  await new Promise<void>((r) => server.close(() => r()));
  store.db.close();
  rmSync(profile, { recursive: true, force: true });
}
