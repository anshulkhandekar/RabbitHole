import { chromium, expect } from "@playwright/test";
import { createServer } from "node:http";
import {
  mkdtempSync,
  cpSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { analysis } from "./support";
import type {
  Session,
  Attempt,
  AnalysisData,
} from "../packages/contracts/src/index";
const server = createServer((_, res) => {
  res.setHeader("Content-Type", "application/json");
  res.end("[]");
}).listen(0, "127.0.0.1");
await new Promise<void>((r) => server.once("listening", r));
const port = (server.address() as { port: number }).port;
const profile = mkdtempSync(tmpdir() + "/rabbithole-refresh-"),
  extension = profile + "/extension";
cpSync(resolve("dist/extension"), extension, { recursive: true });
const manifest = JSON.parse(readFileSync(extension + "/manifest.json", "utf8"));
manifest.host_permissions = ["http://*/*", "https://*/*"];
writeFileSync(extension + "/manifest.json", JSON.stringify(manifest));
const context = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
  ],
});
context.setDefaultTimeout(10000);
const errors: string[] = [];
try {
  const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker")),
    id = new URL(worker.url()).host;
  const page = await context.newPage();
  await page.clock.install();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  const a: AnalysisData = {
    ...analysis(),
    concepts: [
      { ...analysis().concepts[0], main: true },
      { ...analysis().concepts[1], parentId: "n1" },
      { ...analysis().concepts[0], id: "n3", main: true, label: "Isolation" },
      {
        ...analysis().concepts[0],
        id: "n4",
        main: true,
        label: "Passive isolation",
      },
    ],
    studyItems: [],
  };
  const q = analysis().studyItems[0];
  for (let i = 0; i < 8; i++)
    a.studyItems.push({
      ...q,
      id: `basic${i}`,
      prompt: `Which operation can run independently? Example ${i + 1}`,
      conceptIds: ["n2"],
    });
  for (let i = 0; i < 5; i++)
    a.studyItems.push({
      ...q,
      id: `hard${i}`,
      prompt: `Apply parallel execution to a new workload. Example ${i + 1}`,
      conceptIds: ["n1"],
      level: i % 2 ? "transfer" : "apply",
    });
  for (let i = 0; i < 5; i++)
    a.studyItems.push({
      ...q,
      id: `isolation${i}`,
      prompt: `What does isolation prevent? Example ${i + 1}`,
      conceptIds: ["n3"],
    });
  a.studyItems.push({
    ...q,
    id: "retry",
    variantOf: "isolation0",
    conceptIds: ["n3"],
  });
  a.studyItems.push(
    { ...analysis().studyItems[1], conceptIds: ["n1"] },
    { ...analysis().studyItems[2], conceptIds: ["n1"] },
  );
  const answer = (
    studyId: string,
    rating: Attempt["rating"] = "understood",
    confidence: Attempt["confidence"] = "think",
  ): Attempt => ({
    id: `attempt_${studyId}`,
    studyId,
    rating,
    confidence,
    response: "Parallel",
    analysisVersion: 1,
    timestamp: new Date().toISOString(),
  });
  const session: Session = {
    id: "s1",
    title: "Parallel computing",
    short: "Parallel computing",
    status: "paused",
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      depth: "balanced",
      analogy: "everyday examples",
      activities: ["quiz", "matching"],
      articleCapture: true,
      autoHighlights: false,
    },
    analysis: a,
    attempts: [
      ...a.studyItems
        .filter(
          (i) =>
            (i.conceptIds.includes("n1") && !i.level) ||
            i.id.startsWith("basic"),
        )
        .map((i) => answer(i.id)),
      answer("isolation0", "again", "sure"),
    ],
    captures: [],
    processed: [],
  };
  const baseState = {
    sessions: { s1: session },
    active: "s1",
    config: {
      backend: `http://127.0.0.1:${port}`,
      token: "fixture-only",
      agentUrl: "https://go.example",
    },
    tabs: {},
    lastCapture: {},
    excluded: { s1: ["site:example.com"] },
    queue: [],
    handoffs: {},
    mapSeen: { s1: 0 },
    goCompletion: "notify",
  };
  const seed = async (
    changes: object = {},
    hash = "practice",
    panel = false,
  ) => {
    if (page.url().startsWith("chrome-extension:"))
      await page.evaluate(() => chrome.runtime.sendMessage({ type: "state" }));
    await page.goto("about:blank");
    await worker.evaluate(
      async (value) => {
        await chrome.storage.local.set({ state: value, uiTheme: "system" });
        await chrome.storage.session.set({
          bindings: { tabs: {}, lastCapture: {} },
        });
      },
      { ...baseState, ...changes },
    );
    await page.setViewportSize(
      panel ? { width: 380, height: 900 } : { width: 1440, height: 1000 },
    );
    await page.goto(
      `chrome-extension://${id}/index.html?${panel ? "panel" : "workspace"}=1#${hash}`,
    );
    await page.locator(panel ? ".panel" : ".ws").waitFor();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
  };
  const shot = async (name: string, scheme: string) => {
    await page.screenshot({
      path: `test-results/ui-refresh-${name}-${scheme}.png`,
      fullPage: true,
    });
  };
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await seed();
    await expect(
      page.getByRole("navigation", { name: "Practice topics" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "More actions", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Settings", exact: true }),
    ).toBeVisible();
    await shot("hub-incomplete", scheme);
    await page.getByRole("button", { name: /^Start / }).click();
    await page.locator('[aria-haspopup="dialog"]').click();
    await expect(
      page.getByRole("dialog", { name: "Switch practice topic" }),
    ).toBeVisible();
    await shot("round-switcher", scheme);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("dialog", { name: "Switch practice topic" }),
    ).toHaveCount(0);
    await expect(page.locator('[aria-haspopup="dialog"]')).toBeFocused();
    await page.locator('[aria-haspopup="dialog"]').click();
    await page.mouse.click(1400, 900);
    await expect(
      page.getByRole("dialog", { name: "Switch practice topic" }),
    ).toHaveCount(0);
    await seed({ sessions: { s1: { ...session, analysis: null } } });
    await expect(
      page.getByRole("heading", { name: "Practice starts with a saved map" }),
    ).toBeVisible();
    await shot("no-analysis", scheme);
    await seed({
      sessions: { s1: { ...session, analysis: null } },
      config: { ...baseState.config, token: "" },
    });
    await expect(
      page.getByRole("button", { name: "Connect Go", exact: true }),
    ).toBeVisible();
    await shot("disconnected", scheme);
    await seed({
      sessions: {
        s1: { ...session, attempts: a.studyItems.map((i) => answer(i.id)) },
      },
    });
    await expect(
      page.getByRole("heading", { name: /You've tried every question/ }),
    ).toBeVisible();
    await shot("exhausted", scheme);
    await seed();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    for (const section of [
      "Appearance",
      "Collection",
      "Practice",
      "Connection",
      "Session",
    ]) {
      await page.getByRole("button", { name: section, exact: true }).click();
      await shot(`settings-workspace-${section.toLowerCase()}`, scheme);
    }
    await page.getByRole("button", { name: "Connection", exact: true }).click();
    await page.getByRole("button", { name: "Change connection…" }).click();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Replace", exact: true }).click();
    await expect(page.locator('input[type="password"]')).toHaveValue("");
    await shot("connection-editor", scheme);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Settings", exact: true }),
    ).toBeFocused();
    await seed({}, "map", true);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    for (const section of [
      "Appearance",
      "Collection",
      "Practice",
      "Connection",
      "Session",
    ]) {
      await page.getByRole("button", { name: section, exact: true }).click();
      await shot(`settings-panel-${section.toLowerCase()}`, scheme);
    }
    const hand = {
      sessionId: "s1",
      prompt: "Synthetic fixture",
      copied: true,
      opened: true,
      version: 0,
      captureIds: ["c1", "c2"],
      startedAt: new Date().toISOString(),
      status: "saved",
      savedAt: new Date().toISOString(),
      savedVersion: 1,
      ideas: 4,
      questions: 12,
      finds: 2,
    };
    for (const panel of [false, true]) {
      await seed({ handoffs: { s1: hand } }, "sources", panel);
      await expect(
        page.getByText("Your map is ready", { exact: true }),
      ).toBeVisible();
      await shot(`ready-${panel ? "panel" : "workspace"}`, scheme);
      if (!panel) {
        await page.locator(".ready-note").hover();
        await page.clock.fastForward(15000);
        await expect(page.locator(".ready-note")).toBeVisible();
        await page.mouse.move(10, 500);
        await page
          .locator(".ready-note")
          .getByRole("button", { name: "Open map", exact: true })
          .focus();
        await page.clock.fastForward(15000);
        await expect(page.locator(".ready-note")).toBeVisible();
        await page
          .getByRole("button", { name: "Settings", exact: true })
          .focus();
        await page.clock.fastForward(12000);
        await expect(page.locator(".ready-note")).toHaveCount(0);
      }
      await page.keyboard.press("Escape");
      await expect(
        page.getByText("Your map is ready", { exact: true }),
      ).toHaveCount(0);
      await seed(
        {
          goCompletion: "quiet",
          handoffs: {
            s1: {
              ...hand,
              status: "failed",
              reason: "The save cited a deleted find.",
            },
          },
        },
        "sources",
        panel,
      );
      await expect(
        page.getByText("Go couldn't save your map", { exact: true }),
      ).toBeVisible();
      await shot(`failed-${panel ? "panel" : "workspace"}`, scheme);
    }
    await seed({ goCompletion: "quiet", handoffs: { s1: hand } }, "sources");
    await expect(
      page.locator('.segmented[aria-label="Views"] .new-find-dot'),
    ).toHaveCount(1);
    await expect(
      page.getByText("Your map is ready", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("tablist", { name: "Views" })
      .getByRole("tab", { name: "Map", exact: true })
      .click();
    await expect(
      page.locator('.segmented[aria-label="Views"] .new-find-dot'),
    ).toHaveCount(0);
    await page.bringToFront();
    await seed({ goCompletion: "open", handoffs: { s1: hand } }, "sources");
    await expect(
      page
        .getByRole("tablist", { name: "Views" })
        .getByRole("tab", { name: "Map", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    const other = await context.newPage();
    await other.bringToFront();
    await seed({ goCompletion: "open", handoffs: { s1: hand } }, "sources");
    await expect(
      page.getByText("Your map is ready", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: "Sources 0", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await other.close();
    await page.bringToFront();
  }
  // Delay only initial state delivery to exercise the real loading screen and its retry threshold.
  await page.addInitScript(() => {
    if (!location.search.includes("slow=1")) return;
    const send = chrome.runtime.sendMessage.bind(chrome.runtime);
    chrome.runtime.sendMessage = ((msg: any, ...args: any[]) =>
      msg.type === "state"
        ? new Promise((resolve) =>
            setTimeout(() => resolve(send(msg, ...args)), 10000),
          )
        : send(msg, ...args)) as typeof chrome.runtime.sendMessage;
  });
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto(
      `chrome-extension://${id}/index.html?workspace=1&slow=1#practice`,
    );
    await expect(
      page.getByText("Loading your questions…", { exact: true }),
    ).toBeVisible();
    await shot("loading", scheme);
    await expect(
      page.getByRole("button", { name: "Try again", exact: true }),
    ).toBeVisible({ timeout: 9500 });
  }
  expect(errors).toEqual([]);
  console.log(
    "PASS UI refresh fixtures: light/dark hub, incomplete/disconnected/no-analysis/exhausted/loading, round switcher dismissal and focus, five Settings sections in workspace/panel, empty token replacement, ready/failed notes in both surfaces, quiet Map dot.",
  );
} finally {
  await context.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  rmSync(profile, { recursive: true, force: true });
}
