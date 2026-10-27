// Packaged-extension regressions; synthetic pages and an isolated profile.
import { chromium, expect } from "@playwright/test";
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
import { createServer } from "node:http";
import { createApp } from "../apps/server/src/app";
import { Store } from "../apps/server/src/store";
import { analysis, capture } from "./support";
import { Capture } from "../packages/contracts/src/index";

const profile = mkdtempSync(tmpdir() + "/rabbithole-review-");
const extension = profile + "/extension";
cpSync(resolve("dist/extension"), extension, { recursive: true });
const manifest = JSON.parse(readFileSync(extension + "/manifest.json", "utf8"));
manifest.host_permissions = ["http://*/*", "https://*/*"];
writeFileSync(extension + "/manifest.json", JSON.stringify(manifest));
writeFileSync(
  extension + "/test-open-shadow.js",
  `
  const attach = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function(init) {
    return attach.call(this, { ...init, mode: "open" });
  };
`,
);
const browser = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  headless: true,
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
  ],
});
const pageErrors: string[] = [];
browser.on("page", (p) => p.on("pageerror", (e) => pageErrors.push(e.message)));
try {
  const failures: string[] = [];
  const worker =
    browser.serviceWorkers()[0] ??
    (await browser.waitForEvent("serviceworker"));
  const ui = await browser.newPage();
  await ui.goto(new URL("index.html", worker.url()).href);
  const page = await browser.newPage();
  await page.route("https://www.google.com/**", (r) =>
    r.fulfill({ contentType: "text/html", body: "<main>Results</main>" }),
  );
  await page.goto("https://www.google.com/search?q=tides");
  await page.bringToFront();
  const started = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "start", title: "Tides" }),
  );
  assert.ok(started.active, JSON.stringify(started));
  await page.waitForTimeout(2500);
  const before = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "state" }),
  );
  const find = before.sessions[started.active].captures.find(
    (c: any) => c.sourceType === "search",
  );
  assert.ok(find, "fixture search was captured");
  await ui.evaluate(
    ({ id, captureId }) =>
      chrome.runtime.sendMessage({ type: "capture-delete", id, captureId }),
    { id: started.active, captureId: find.id },
  );
  // Force the next extraction pass through the content script's normal listener.
  await page.evaluate(() =>
    window.dispatchEvent(new Event("rabbithole-refresh")),
  );
  await page.waitForTimeout(2500);
  const after = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "state" }),
  );
  if (
    after.sessions[started.active].captures.some((c: any) => c.text === "tides")
  )
    failures.push("deleted search was automatically recaptured");
  await page.goto("https://www.google.com/search?q=moon");
  await page.waitForTimeout(2500);
  await page.close();
  const db = new Store(":memory:"),
    token = "review-fixture-" + "x".repeat(50);
  const app = createApp(db, [{ owner: "review", token }]);
  const server = createServer(async (req, res) => {
    if (req.method === "POST" && req.url?.endsWith("/captures")) {
      const chunks = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString());
      db.capture("review", body.sessionId, body);
      // The database committed, but the client did not get a success response.
      res.writeHead(503);
      res.end();
    } else app(req, res);
  }).listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  try {
    await ui.evaluate(
      (config) => chrome.runtime.sendMessage({ type: "config", config }),
      {
        backend: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
        token,
        agentUrl: "https://fixture.example/agent",
      },
    );
    const pending = await ui.evaluate(() =>
      chrome.runtime.sendMessage({ type: "state" }),
    );
    const saved = pending.sessions[started.active].captures[0];
    assert.ok(
      db.get("review", started.active).captures.some((c) => c.id === saved.id),
    );
    await ui.evaluate(
      ({ id, captureId }) =>
        chrome.runtime.sendMessage({ type: "capture-delete", id, captureId }),
      { id: started.active, captureId: saved.id },
    );
    await ui.evaluate(() => chrome.runtime.sendMessage({ type: "refresh" }));
    const restored = await ui.evaluate(() =>
      chrome.runtime.sendMessage({ type: "state" }),
    );
    if (
      restored.sessions[started.active].captures.some(
        (c: any) => c.id === saved.id,
      )
    )
      failures.push(
        "deleted find resurrected after committed POST returned 503",
      );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    db.db.close();
  }

  // Open the extension's shadow only in this isolated test copy, before its
  // real content script runs. The card and worker use the packaged code.
  await ui.evaluate(() =>
    chrome.runtime.sendMessage({
      type: "config",
      config: {
        backend: "http://127.0.0.1:3210",
        token: "",
        agentUrl: "https://fixture.example/agent",
      },
    }),
  );
  await ui.evaluate(
    (id) => chrome.runtime.sendMessage({ type: "delete", id }),
    started.active,
  );
  await ui.evaluate(() =>
    chrome.scripting.registerContentScripts([
      {
        id: "test-open-shadow",
        matches: ["https://www.google.com/*"],
        js: ["test-open-shadow.js"],
        runAt: "document_start",
      },
    ]),
  );
  const search = await browser.newPage();
  await search.route("https://www.google.com/**", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<main>Synthetic search results</main>",
    }),
  );
  await search.goto("https://www.google.com/search?q=tides");
  await search.bringToFront();
  const goal = search.getByPlaceholder(
    "What are you trying to figure out? (optional)",
  );
  await goal.waitFor();
  await search
    .locator(".offer button.primary")
    .evaluate((b: HTMLButtonElement) => b.click());
  assert.equal(
    (await ui.evaluate(() => chrome.runtime.sendMessage({ type: "state" })))
      .active,
    undefined,
    "synthetic clicks cannot start collection",
  );
  await goal.fill("Why are there two tides a day?");
  await search.getByRole("button", { name: "Know some", exact: true }).click();
  await goal.press("Enter");
  await expect(search.locator(".offer")).toHaveCount(0);
  const keyboard = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "state" }),
  );
  const firstId = keyboard.active;
  assert.equal(
    keyboard.sessions[firstId].goal,
    "Why are there two tides a day?",
  );
  assert.equal(keyboard.sessions[firstId].familiarity, "some");
  await expect
    .poll(
      async () =>
        (await ui.evaluate(() => chrome.runtime.sendMessage({ type: "state" })))
          .sessions[firstId].captures.length,
    )
    .toBe(1);
  await search.goto("https://www.google.com/search?q=best+pasta+recipes");
  await search
    .getByText("New topic? Start a new rabbit hole", { exact: true })
    .waitFor();
  await goal.fill("How do I make pasta?");
  await search.getByRole("button", { name: "Start new", exact: true }).click();
  await expect(search.locator(".offer")).toHaveCount(0);
  const switched = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "state" }),
  );
  const secondId = switched.active;
  assert.notEqual(secondId, firstId);
  assert.equal(switched.sessions[firstId].status, "paused");
  assert.equal(
    switched.sessions[firstId].captures.some(
      (c: any) => c.text === "best pasta recipes",
    ),
    false,
  );
  assert.equal(switched.sessions[secondId].goal, "How do I make pasta?");
  await ui.evaluate(
    (id) =>
      chrome.runtime.sendMessage({
        type: "patch",
        id,
        patch: { status: "paused" },
      }),
    secondId,
  );
  await search.goto("https://www.google.com/search?q=pasta+sauce");
  await search.getByRole("button", { name: /^Add to/ }).click();
  await expect(search.locator(".offer")).toHaveCount(0);
  assert.equal(
    (await ui.evaluate(() => chrome.runtime.sendMessage({ type: "state" })))
      .sessions[secondId].status,
    "active",
  );
  await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "ask-on-search", value: false }),
  );
  await search.goto("https://www.google.com/search?q=another+unrelated+topic");
  await search.waitForTimeout(1700);
  await expect(search.locator(".offer")).toHaveCount(0);
  await search.close();

  // Seed a source-grounded Go-shaped guide to test the new screens and downloads.
  const guide = analysis();
  Object.assign(guide, { sessionId: secondId });
  Object.assign(guide.concepts[1], {
    claim: "Parallel execution runs many operations together.",
    why: "One processor would do each task in turn.",
    steps: ["Split independent work.", "Run the pieces together."],
    buildsOn: ["n1"],
    example: "Shade many pixels in one batch.",
    boundary: "Dependent work still has to wait.",
    gap: "Memory bandwidth was not explained.",
    nextSearch: "GPU memory bandwidth explained",
    evidence: [{ captureId: "c1", quote: "process many operations at once" }],
  });
  Object.assign(guide.studyItems[0], {
    hints: ["Think about batches."],
    choiceExplanations: [
      "That confuses parallel execution with sequential execution.",
      "The source describes many operations at once.",
    ],
    evidence: [{ captureId: "c1", quote: "process many operations at once" }],
  });
  await ui.evaluate(
    async ({ id, guide, source }) => {
      const state: any = (await chrome.storage.local.get("state")).state;
      Object.assign(state.sessions[id], {
        title: "Stage 3 user test",
        status: "paused",
        version: 1,
        analysis: guide,
        processed: ["c1"],
        captures: [source],
        attempts: [],
      });
      await chrome.storage.local.set({ state });
    },
    {
      id: secondId,
      guide,
      source: Capture.parse({ ...capture(), sessionId: secondId }),
    },
  );
  await ui.goto(new URL("index.html?workspace=1", worker.url()).href);
  await ui.bringToFront();
  await ui.emulateMedia({ reducedMotion: "reduce" });
  const statusBox = await ui.locator(".topbar .capture-btn").boundingBox();
  const tabsBox = await ui.locator(".topbar > .segmented").boundingBox();
  assert.ok(
    statusBox && tabsBox && statusBox.x + statusBox.width <= tabsBox.x,
    "desktop navigation must not cover collection controls",
  );
  await ui.getByRole("tab", { name: /^Sources/ }).click();
  await ui.getByRole("button", { name: "Find actions", exact: true }).click();
  await ui
    .getByRole("menuitem", { name: "Hide from map", exact: true })
    .click();
  await ui.getByText("Hidden from map", { exact: true }).waitFor();
  await ui.getByRole("tab", { name: "Map", exact: true }).click();
  await ui.locator('.react-flow__node[data-id="n2"]').click();
  await ui.getByText("Sources removed", { exact: true }).waitFor();
  await expect(ui.locator(".idea-drawer .source-quote")).toHaveCount(0);
  await ui.getByRole("tab", { name: /^Sources/ }).click();
  await ui.getByRole("button", { name: "Find actions", exact: true }).click();
  await ui
    .getByRole("menuitem", { name: "Show on map again", exact: true })
    .click();
  await expect(ui.getByText("Hidden from map", { exact: true })).toHaveCount(0);
  await ui.getByRole("tab", { name: "Map", exact: true }).click();
  await ui.locator('.react-flow__node[data-id="n2"]').click();
  await ui
    .getByText("Parallel execution runs many operations together.", {
      exact: true,
    })
    .waitFor();
  await ui.getByText("Split independent work.", { exact: true }).waitFor();
  await ui
    .getByText("Shade many pixels in one batch.", { exact: true })
    .waitFor();
  await expect(ui.locator(".idea-drawer .source-quote")).toHaveCount(1);
  await expect(ui.locator(".search-chip")).toHaveAttribute(
    "href",
    "https://www.google.com/search?q=GPU%20memory%20bandwidth%20explained",
  );
  for (const colorScheme of ["light", "dark"] as const) {
    await ui.emulateMedia({ colorScheme });
    await ui.screenshot({
      path: `test-results/stage3-drawer-${colorScheme}.png`,
      fullPage: true,
    });
  }
  await ui.getByRole("tab", { name: "Practice", exact: true }).click();
  await ui.getByRole("button", { name: /^Quiz / }).click();
  await ui.getByRole("button", { name: "Sure", exact: true }).click();
  await ui.getByRole("button", { name: /show a hint/ }).click();
  await ui.getByText("Think about batches.", { exact: false }).waitFor();
  await ui.locator(".run-options button").first().click();
  await ui.getByRole("heading", { name: /Confident miss/ }).waitFor();
  await ui
    .locator(".miss-note textarea")
    .fill("I thought parallel meant faster sequential work.");
  await ui.screenshot({
    path: "test-results/stage3-quiz-feedback.png",
    fullPage: true,
  });
  await ui.getByRole("button", { name: /^Continue/ }).click();
  const reviewed = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "state" }),
  );
  const attempt = reviewed.sessions[secondId].attempts[0];
  assert.equal(attempt.confidence, "sure");
  assert.equal(attempt.hintsUsed, 1);
  assert.equal(
    attempt.note,
    "I thought parallel meant faster sequential work.",
  );
  await ui.getByRole("tab", { name: "Summary", exact: true }).click();
  const csvDownload = ui.waitForEvent("download");
  await ui.getByRole("button", { name: "Anki", exact: true }).click();
  const csvPath = await (await csvDownload).path();
  assert.ok(readFileSync(csvPath!, "utf8").includes("https://example.org/gpu"));
  const mdDownload = ui.waitForEvent("download");
  await ui.getByRole("button", { name: "Markdown", exact: true }).click();
  const mdPath = await (await mdDownload).path();
  assert.ok(
    readFileSync(mdPath!, "utf8").includes("Shade many pixels in one batch."),
  );
  assert.deepEqual(failures, []);
  assert.deepEqual(pageErrors, []);
  console.log(
    "PASS Stage 3 user flow: deletion/retry recovery; trusted search start, topic switch, resume and opt-out; source hide/undo; explanations in both themes; confidence, hint and reasoning persistence; Anki and Markdown downloads.",
  );
} catch (error) {
  const ui = browser
    .pages()
    .find((p) => p.url().startsWith("chrome-extension:"));
  if (ui) {
    console.error(
      "Stage 3 UI at failure:",
      await ui.locator("body").innerText(),
      pageErrors,
    );
    await ui.screenshot({
      path: "test-results/stage3-failure.png",
      fullPage: true,
    });
  }
  throw error;
} finally {
  await browser.close();
  rmSync(profile, { recursive: true, force: true });
}
