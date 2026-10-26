import { createServer } from "node:http";
import { chromium, expect } from "@playwright/test";
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
let releaseReview: (() => void) | undefined;
let reviewStarted: (() => void) | undefined;
let reviewGate: Promise<void> | undefined;
const app = createApp(store, [{ owner: "test", token }]);
const server = createServer((req, res) => {
  if (!backendAvailable) {
    res.writeHead(503);
    res.end();
  } else if (req.url?.endsWith("/reviews") && reviewGate) {
    reviewStarted?.();
    void reviewGate.then(() => app(req, res));
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
const remoteFontRequests: string[] = [];
context.on("request", (r) => {
  if (/fonts\.(googleapis|gstatic)\.com/.test(r.url()))
    remoteFontRequests.push(r.url());
});
context.on("page", (p) =>
  p.on("pageerror", (e) => failures.push(`${p.url()}: ${e.stack}`)),
);
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
  await ui.getByLabel("Go agent URL").fill("https://handoff.example/agent");
  // Grant website access through the extension UI; Chrome headless has no native permission bubble.
  await ui.getByRole("button", { name: "Save connection" }).click();
  await ui.getByRole("button", { name: "Start collecting" }).waitFor();
  const research = await context.newPage();
  await research.route("https://www.google.com/**", (r) =>
    r.fulfill({
      contentType: "text/html; charset=utf-8",
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
  const tabContext = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "ui-context" }),
  );
  assert.equal(
    tabContext.included,
    true,
    "UI context must describe actual tab membership",
  );
  assert.equal(tabContext.count, 1);

  await research.waitForTimeout(1800);
  let state = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "state" }),
  );
  assert.equal(state.sessions[sessionId].captures[0]?.sourceType, "search");
  await research.route("https://research.example/**", (r) =>
    r.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<html><head><title>Parallel computing — test fixture</title></head><body><article><h1>How parallel execution works</h1><p id="passage">${"A GPU uses parallel execution to process many operations at once. ".repeat(14)}</p><p>Independent operations can run together. Dependent operations must wait for inputs. This is synthetic test material.</p></article><input value="DO NOT CAPTURE PASSWORD"><div contenteditable="true">DO NOT CAPTURE EDITABLE TEXT</div></body></html>`,
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
  await ui.evaluate(() => chrome.runtime.sendMessage({ type: "reading-mode" }));
  const indicator = research.locator("[data-rabbithole-reading]");
  await indicator.waitFor();
  assert.ok(
    (await indicator.boundingBox())!.width <= 60,
    "Reading mode should leave only a compact rabbit until hovered",
  );
  await indicator.hover();
  await research.getByRole("button", { name: "Pause", exact: true }).click();
  await research.getByRole("button", { name: "Resume", exact: true }).waitFor();
  state = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "state" }),
  );
  assert.equal(state.sessions[sessionId].status, "paused");
  await research.getByRole("button", { name: "Resume", exact: true }).click();
  await research.getByRole("button", { name: "Pause", exact: true }).waitFor();
  await research.locator("h1").click();
  await research.mouse.move(500, 300);
  await research.screenshot({ path: "test-results/reading-indicator.png" });
  await indicator.hover();
  assert.equal(
    await indicator.evaluate(
      (el) => el.getAnimations({ subtree: true }).length,
    ),
    0,
  );
  await research.getByRole("button", { name: "Hide", exact: true }).click();
  await indicator.waitFor({ state: "detached" });
  await research.evaluate(() => {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector("#passage")!);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
  });
  await research.waitForTimeout(1100);
  state = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "state" }),
  );
  assert.equal(
    state.sessions[sessionId].captures.filter(
      (c: any) => c.sourceType === "highlight",
    ).length,
    0,
    "Selecting alone must not capture without opt-in",
  );
  await ui.evaluate(async (id) => {
    const s = await chrome.runtime.sendMessage({ type: "state" });
    await chrome.runtime.sendMessage({
      type: "patch",
      id,
      patch: { settings: { ...s.sessions[id].settings, autoHighlights: true } },
    });
  }, sessionId);
  await research.evaluate(() => {
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    const range = document.createRange();
    range.selectNodeContents(document.querySelector("#passage")!);
    selection.addRange(range);
  });
  await research.waitForTimeout(1100);
  state = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "state" }),
  );
  assert.equal(
    state.sessions[sessionId].captures.filter(
      (c: any) => c.sourceType === "highlight",
    ).length,
    0,
    "A page script selecting text must not imitate a user highlight",
  );
  await research.locator("#passage").click({ clickCount: 3 });
  await research.waitForTimeout(1300);
  state = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "state" }),
  );
  assert.equal(
    state.sessions[sessionId].captures.filter(
      (c: any) => c.sourceType === "highlight",
    ).length,
    1,
    "Opted-in selection must save once without a shortcut",
  );
  await research.locator("[contenteditable]").click();
  await research.evaluate(() => {
    const r = document.createRange();
    r.selectNodeContents(document.querySelector("[contenteditable]")!);
    const s = window.getSelection()!;
    s.removeAllRanges();
    s.addRange(r);
  });
  await research.waitForTimeout(1000);
  state = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "state" }),
  );
  assert.equal(
    state.sessions[sessionId].captures.filter(
      (c: any) => c.sourceType === "highlight",
    ).length,
    1,
    "Editable selections must not become highlights",
  );
  await research.locator("#passage").click();
  await research.evaluate(() => {
    const r = document.createRange();
    r.selectNodeContents(document.querySelector("#passage")!);
    const s = window.getSelection()!;
    s.removeAllRanges();
    s.addRange(r);
  });
  await ui.evaluate(async (id) => {
    const s = await chrome.runtime.sendMessage({ type: "state" });
    await chrome.runtime.sendMessage({
      type: "patch",
      id,
      patch: {
        settings: { ...s.sessions[id].settings, autoHighlights: false },
      },
    });
  }, sessionId);
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
    r.fulfill({
      body: "<h1>Unrelated search</h1>",
      contentType: "text/html; charset=utf-8",
    }),
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
  // Handoff opens a test Go page, never invokes generation or writes a fixture itself.
  await context.route("https://handoff.example/**", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: "<h1>Synthetic Go handoff destination</h1>",
    }),
  );
  await ui.setViewportSize({ width: 320, height: 850 });
  await ui.bringToFront();
  await ui.getByRole("button", { name: "Send to Go", exact: true }).click();
  const handoffPrompt = await ui
    .getByLabel("Go processing prompt")
    .inputValue();
  assert.ok(handoffPrompt.includes(sessionId));
  await ui.getByText("Paste it into Go and send", { exact: true }).waitFor();
  assert.equal(await ui.getByText(/Map updated at/).count(), 0);
  await ui.screenshot({
    path: "test-results/sidebar-handoff.png",
    fullPage: true,
  });
  await ui.setViewportSize({ width: 1280, height: 800 });
  await ui.evaluate(
    (id) =>
      chrome.runtime.sendMessage({
        type: "patch",
        id,
        patch: { status: "paused" },
      }),
    sessionId,
  );
  const fixture: import("../packages/contracts/src/index").AnalysisData =
    analysis();
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
  fixture.concepts[1].captureIds = [
    store
      .get("test", sessionId)
      .captures.find((c) => c.sourceType === "highlight")!.id,
  ];
  fixture.concepts[1].gap = "Which operations cannot run independently?";
  fixture.edges.push({
    ...fixture.edges[0],
    id: "e2",
    source: "n2",
    target: "n1",
    label: "can accelerate",
    evidenceKind: "inference" as any,
  });
  fixture.overview = {
    rootConceptId: "n1",
    summary:
      "This synthetic trail connects a GPU to parallel execution and asks when independence matters.",
    takeaways: [
      "Independent operations can run together.",
      "Dependencies limit parallel execution.",
    ],
    route: ["n1", "n2"],
  };
  fixture.concepts[1].parentId = "n1";
  fixture.concepts[0].takeaways = ["A GPU runs independent work concurrently."];
  fixture.concepts[0].example =
    "Independent operations can be assigned to different workers; dependent operations must wait.";
  fixture.concepts[0].boundary =
    "The captured example does not establish that every workload runs faster.";
  fixture.concepts[0].evidence = [
    {
      captureId: evidence,
      quote:
        "A GPU uses parallel execution to process many operations at once.",
    },
  ];
  fixture.studyItems[0].choices = [
    "Sequential only",
    "Parallel execution",
    "Only higher clock speed",
    "Only more memory",
  ];
  fixture.studyItems[0].choiceExplanations = [
    "The captured sentence describes multiple operations at once, not sequential-only execution.",
    "This matches the captured sentence about parallel execution.",
    "The source does not attribute concurrency to clock speed.",
    "Memory capacity does not describe the execution model in this source.",
  ];
  fixture.studyItems.push({
    id: "m1",
    type: "matching",
    prompt: "Match the ideas to their meanings",
    answer:
      "A GPU is a processor; parallel execution describes operations proceeding at once.",
    pairs: [
      { left: "GPU", right: "Processor" },
      { left: "Parallel execution", right: "Concurrent operations" },
    ],
    conceptIds: ["n1", "n2"],
    captureIds: [evidence],
  });
  fixture.concepts.push(
    {
      id: "n3",
      label: "Work independence",
      explanation:
        "This synthetic example distinguishes operations that can proceed together from those waiting for inputs.",
      captureIds: [evidence],
      parentId: "n1",
      takeaways: ["Independent work does not need an earlier result."],
      example: "Two independent calculations can start together.",
      boundary: "A dependency changes that conclusion.",
    },
    {
      id: "n4",
      label: "Dependency constraints",
      explanation:
        "A dependency requires an operation to wait for its input, limiting which work can proceed at the same time.",
      captureIds: [evidence],
      parentId: "n1",
    },
    {
      id: "n5",
      label: "Concurrent work units",
      explanation:
        "Independent operations form work units that can proceed together in this synthetic example.",
      captureIds: [evidence],
      parentId: "n3",
    },
    {
      id: "n6",
      label: "Waiting for inputs",
      explanation:
        "Dependent operations wait for inputs in the synthetic example.",
      captureIds: [evidence],
      parentId: "n4",
    },
  );
  fixture.edges.push(
    {
      id: "e3",
      source: "n1",
      target: "n3",
      label: "needs independent work for concurrency",
      explanation:
        "The synthetic example contrasts independent operations with waiting for inputs.",
      captureIds: [evidence],
      evidenceKind: "supported",
    },
    {
      id: "e4",
      source: "n4",
      target: "n1",
      label: "limits available concurrency",
      explanation:
        "Waiting for required inputs limits concurrent execution in this synthetic example.",
      captureIds: [evidence],
      evidenceKind: "supported",
    },
    {
      id: "e5",
      source: "n3",
      target: "n5",
      label: "permits",
      explanation: "Independent units can proceed together.",
      captureIds: [evidence],
      evidenceKind: "supported",
    },
    {
      id: "e6",
      source: "n4",
      target: "n6",
      label: "requires",
      explanation: "Dependent operations wait for inputs.",
      captureIds: [evidence],
      evidenceKind: "supported",
    },
  );
  fixture.title = "SYNTHETIC UI TEST · Parallel computing";
  console.log("CHECK fixture saved");
  store.save("test", fixture);
  await ui.bringToFront();
  await ui.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await ui.getByRole("tab", { name: "Summary", exact: true }).click();
  await ui.getByRole("heading", { name: fixture.title, exact: true }).waitFor();
  await ui.getByRole("button", { name: "Dismiss", exact: true }).click();
  await ui.getByRole("tab", { name: "Map", exact: true }).click();
  await expect(ui.locator(".react-flow__node")).toHaveCount(6);
  await ui.locator('.react-flow__node[data-id="n1"]').click();
  await ui.getByRole("heading", { name: "GPU", exact: true }).waitFor();
  await ui
    .getByRole("heading", { name: "Why it’s on your map", exact: true })
    .waitFor();
  assert.ok(
    (
      await ui
        .locator(".idea-drawer .quoted-text")
        .first()
        .evaluate((el) => getComputedStyle(el).fontFamily)
    ).includes("Literata"),
  );
  const sourceDetails = ui
    .locator(".idea-drawer .source-quote details")
    .first();
  await sourceDetails.locator("summary").click();
  await ui.evaluate(async (id) => {
    const s = await chrome.runtime.sendMessage({ type: "state" });
    await chrome.runtime.sendMessage({
      type: "patch",
      id,
      patch: {
        settings: {
          ...s.sessions[id].settings,
          analogy: "A changed preference in a synthetic background update",
        },
      },
    });
    await chrome.runtime.sendMessage({ type: "refresh" });
  }, sessionId);
  await expect(sourceDetails).toHaveAttribute("open", "");
  await expect(ui.locator(".world-label")).not.toHaveCount(0);
  await ui.keyboard.press("Escape");
  await expect(ui.locator(".idea-drawer")).toHaveCount(0);
  await ui.setViewportSize({ width: 880, height: 800 });
  await ui.locator('.react-flow__node[data-id="n1"]').click();
  const canvasBox = await ui.locator(".map-canvas").boundingBox(),
    drawerBox = await ui.locator(".idea-drawer").boundingBox();
  assert.ok(
    drawerBox!.y > canvasBox!.y && drawerBox!.width > 600,
    "Drawer becomes a bottom sheet below 900px",
  );
  await ui.setViewportSize({ width: 1280, height: 800 });
  await ui.keyboard.press("Escape");
  for (const colorScheme of ["light", "dark"] as const) {
    await ui.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await ui.screenshot({
      path: `test-results/workspace-${colorScheme}.png`,
      fullPage: true,
    });
  }
  await ui.getByRole("tab", { name: "Practice", exact: true }).click();
  await ui.getByRole("button", { name: /^Explain the connection/ }).click();
  await ui
    .getByLabel("Your explanation")
    .fill("It runs independent operations at once.");
  await ui
    .getByRole("button", { name: "Reveal explanation", exact: true })
    .click();
  await ui.getByRole("button", { name: /^Partly/ }).click();
  await expect.poll(() => store.get("test", sessionId).attempts.length).toBe(1);
  await ui
    .getByRole("button", { name: "Back to practice", exact: true })
    .click();
  await ui.getByRole("button", { name: /^Quiz / }).click();
  await ui.keyboard.press("2");
  await ui.getByRole("heading", { name: /That’s right/ }).waitFor();
  await ui.getByRole("button", { name: /^Continue/ }).click();
  await expect.poll(() => store.get("test", sessionId).attempts.length).toBe(2);
  await ui
    .getByRole("button", { name: "Back to practice", exact: true })
    .click();
  await ui.getByRole("button", { name: /^Matching / }).click();
  await ui.locator('[data-left="0"]').click();
  await ui.locator('[data-right="1"]').click(); // Slip: no pair may lock.
  await expect(ui.locator(".match-tile-v2.locked")).toHaveCount(0);
  await ui.locator('[data-left="0"]').click();
  await ui.locator('[data-right="0"]').click();
  await expect(ui.locator(".match-tile-v2.locked")).toHaveCount(2);
  await ui.locator('[data-right="1"]').click();
  await ui.locator('[data-left="1"]').click();
  await ui
    .getByRole("heading", { name: "All matched with 1 slip", exact: true })
    .waitFor();
  await ui.getByRole("button", { name: /^Continue/ }).click();
  await expect.poll(() => store.get("test", sessionId).attempts.length).toBe(3);
  assert.deepEqual(
    store.get("test", sessionId).attempts.find((a) => a.studyId === "m1")
      ?.matches,
    [0, 1],
  );
  await ui
    .getByRole("button", { name: "See it on your map", exact: true })
    .click();
  await expect(
    ui.getByRole("button", { name: /What I remember/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await ui.getByRole("tab", { name: /^Sources/ }).click();
  await ui.getByText("On the map", { exact: true }).first().waitFor();
  await ui.reload();
  await ui.getByRole("tab", { name: "Summary", exact: true }).click();
  await ui.getByRole("heading", { name: fixture.title, exact: true }).waitFor();
  assert.equal(store.get("test", sessionId).attempts.length, 3);
  // Exercise the real packaged panel at 320px, both colour schemes and reduced motion.
  await ui.setViewportSize({ width: 320, height: 850 });
  for (const scheme of ["light", "dark"] as const) {
    await ui.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await ui.locator(".panel").waitFor();
    assert.equal(await ui.locator(".p-foot .btn-primary").count(), 1);
    assert.equal(
      await ui
        .getByRole("button", { name: "Send to Go", exact: true })
        .isEnabled(),
      false,
    );
    assert.equal(
      await ui.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.equal(
      await ui.evaluate(
        () =>
          getComputedStyle(document.querySelector(".carrot")!, "::after")
            .animationDuration,
      ),
      "0s",
    );
    assert.equal(
      await ui.evaluate(() => getComputedStyle(document.body).backgroundColor),
      scheme === "dark" ? "rgb(15, 15, 17)" : "rgb(247, 247, 245)",
    );
    await ui.screenshot({
      path: `test-results/sidebar-320-${scheme}.png`,
      fullPage: true,
    });
  }
  await ui
    .getByRole("button", { name: "Switch rabbit hole", exact: true })
    .press("ArrowDown");
  await ui.getByRole("menuitem", { name: /Start a new rabbit hole/ }).waitFor();
  await ui.keyboard.press("Escape");
  await expect(
    ui.getByRole("button", { name: "Switch rabbit hole", exact: true }),
  ).toBeFocused();
  await ui.getByRole("button", { name: "Settings", exact: true }).click();
  await ui.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await ui.getByRole("button", { name: "Close settings", exact: true }).click();
  await ui.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  assert.equal(
    await ui.evaluate(() => getComputedStyle(document.body).backgroundColor),
    "rgb(15, 15, 17)",
  );
  await ui.reload();
  await ui.locator('html[data-theme="dark"]').waitFor();
  await ui.getByRole("button", { name: "Settings", exact: true }).click();
  await ui.getByLabel("Appearance", { exact: true }).selectOption("system");
  await ui.getByRole("button", { name: "Close settings", exact: true }).click();
  await ui.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  console.log("CHECK wait for fonts");
  await ui.evaluate(async () => {
    await document.fonts.ready;
    return true;
  });
  assert.equal(
    await ui.evaluate(() => document.fonts.check('500 14px "Geologica"')),
    true,
  );
  await context.setOffline(true);
  await ui
    .getByText(
      "You’re offline. New finds are saved on this device and will sync later.",
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await ui
      .getByRole("button", { name: "Send to Go", exact: true })
      .isEnabled(),
    false,
  );
  await ui.screenshot({
    path: "test-results/sidebar-offline.png",
    fullPage: true,
  });
  await context.setOffline(false);
  await ui.evaluate(
    (id) =>
      chrome.runtime.sendMessage({
        type: "patch",
        id,
        patch: { status: "paused" },
      }),
    sessionId,
  );
  await ui.getByRole("button", { name: "Resume", exact: true }).waitFor();
  await ui.screenshot({
    path: "test-results/sidebar-paused.png",
    fullPage: true,
  });
  // Membership display is derived from the actual active tab; exclusion is reversible.
  await unrelated.bringToFront();
  await ui.evaluate(() => chrome.runtime.sendMessage({ type: "exclude" }));
  let excludedContext = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "ui-context" }),
  );
  assert.equal(excludedContext.excluded, true);
  await ui.evaluate(
    (url) => chrome.runtime.sendMessage({ type: "unexclude", url }),
    unrelated.url(),
  );
  excludedContext = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "ui-context" }),
  );
  assert.equal(excludedContext.excluded, false);
  await ui.bringToFront();
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
  assert.equal(store.get("test", sessionId).attempts.length, 3);
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
    assert.equal(beforeRetry.sessions[sessionId].attempts.length, 4);
    assert.equal(beforeRetry.sessions[sessionId].status, "paused");
    assert.deepEqual(beforeRetry.tabs, {});
    backendAvailable = true;
    const synced = await recovered.evaluate(() =>
      chrome.runtime.sendMessage({ type: "refresh" }),
    );
    assert.equal(synced.queue.length, 0);
    assert.equal(store.get("test", sessionId).attempts.length, 4);
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
  assert.deepEqual(remoteFontRequests, []);
  console.log(
    "PASS reading first: opt-in trusted selection; programmatic/editable selection excluded; compact indicator pause/resume/hide; disclosure retained across changed storage; measured layered map; scoped quiz with immediate persisted grading; matching checked/persisted; 320px light/dark, offline/paused/handoff states, single primary action, real evidence depth, inferred connections, keyboard selection, local fonts, partial ratings and practice run results; packaged Chrome extension: pregranted website permissions (native prompt untested), automatic search/article capture, input exclusion, highlight, pause, unrelated tab exclusion, explicit include, authenticated sync, persisted fixture display, evidence, recall progress, quiz, flashcard, reload, narrow layout, interrupted delivery, browser profile restart with queued review, retry, and offline deletion without resurrection. Go generation NOT exercised.",
  );
} catch (error) {
  console.error("UI failures:", failures);
  const page = context
    .pages()
    .find((p) => p.url().startsWith("chrome-extension:"));
  if (page) {
    console.error(
      "Graph DOM",
      await page
        .locator(".react-flow__edges")
        .evaluateAll((es) => es.map((e) => e.outerHTML.slice(0, 6000))),
    );
    console.error(
      "Labels",
      await page
        .locator(".edge-label")
        .evaluateAll((es) => es.map((e) => ({ html: e.outerHTML }))),
    );
    console.error((await page.locator("body").innerText()).slice(0, 5000));
    await page.screenshot({
      path: "test-results/redesign-failure.png",
      fullPage: true,
    });
  }
  throw error;
} finally {
  releaseReview?.();
  await context.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  store.db.close();
  rmSync(profile, { recursive: true, force: true });
}
