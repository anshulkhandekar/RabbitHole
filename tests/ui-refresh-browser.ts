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
import { analysis, capture } from "./support";
import {
  Capture,
  type Session,
  type Attempt,
  type AnalysisData,
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
  // Question-only saves replace the session while the map remains mounted.
  await seed({}, "map");
  await expect(page.locator(".react-flow__edge-path")).toHaveCount(1);
  // Initial controlled-node measurement must also recover its handle bounds.
  // Reopening exercises the same async layout/measurement boundary as a cold load.
  for (let opening = 0; opening < 3; opening++) {
    await seed({}, "map");
    await expect(
      page.locator(".react-flow__node .idea-card.ready"),
    ).toHaveCount(4);
    await expect(page.locator(".react-flow__edge-path")).toHaveCount(1);
  }
  for (const version of [2, 3]) {
    await worker.evaluate(async (version) => {
      const { state } = (await chrome.storage.local.get("state")) as {
        state: any;
      };
      state.sessions.s1.version = version;
      state.sessions.s1.analysis.studyItems.push({
        ...state.sessions.s1.analysis.studyItems[0],
        id: `topup-${version}`,
      });
      await chrome.storage.local.set({ state });
    }, version);
    await page.clock.runFor(1500);
    await expect(
      page.locator(".react-flow__node .idea-card.ready"),
    ).toHaveCount(4);
    await expect(page.locator(".react-flow__edge-path")).toHaveCount(1);
    await expect
      .poll(() =>
        page
          .locator(".react-flow__edge-path")
          .evaluateAll((paths) =>
            paths.every(
              (p) =>
                Number.parseFloat(getComputedStyle(p).strokeDashoffset) === 0,
            ),
          ),
      )
      .toBe(true);
  }
  await worker.evaluate(async () => {
    const { state } = (await chrome.storage.local.get("state")) as {
      state: any;
    };
    // Visible graph changes (e.g. source visibility) do not necessarily bump version.
    state.sessions.s1.analysis.concepts.push({
      ...state.sessions.s1.analysis.concepts[0],
      id: "new-detail",
      parentId: "n1",
      main: false,
      label:
        "A newly added detail with a longer label that changes node measurements",
    });
    state.sessions.s1.analysis.edges.push({
      ...state.sessions.s1.analysis.edges[0],
      id: "new-link",
      target: "new-detail",
    });
    await chrome.storage.local.set({ state });
  });
  await page.clock.runFor(1500);
  await expect(page.locator(".react-flow__node .idea-card.ready")).toHaveCount(
    5,
  );
  await expect(page.locator(".react-flow__edge-path")).toHaveCount(2);
  await expect(page.locator(".react-flow__attribution")).toHaveCount(0);
  const canvas = (await page.locator(".map-canvas").boundingBox())!;
  const zoomBefore = await page
    .locator(".react-flow__viewport")
    .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(canvas.x + 120, canvas.y + canvas.height - 120);
    await page.mouse.down();
    await page.mouse.move(
      canvas.x + canvas.width - 30,
      canvas.y + canvas.height - 120,
      { steps: 8 },
    );
    await page.mouse.up();
    await page.clock.runFor(800);
  }
  await expect
    .poll(() =>
      page.locator(".react-flow__node").evaluateAll((nodes) => {
        const host = document
          .querySelector(".map-canvas")!
          .getBoundingClientRect();
        return (
          Math.min(...nodes.map((n) => n.getBoundingClientRect().left)) <
            host.right - 30 &&
          Math.max(...nodes.map((n) => n.getBoundingClientRect().right)) >
            host.left + 30
        );
      }),
    )
    .toBe(true);
  expect(
    await page
      .locator(".react-flow__viewport")
      .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a),
  ).toBeCloseTo(zoomBefore);
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await seed(
    {
      sessions: {
        s1: {
          ...session,
          captures: [Capture.parse(capture())],
          analysis: {
            ...a,
            edges: [
              {
                ...a.edges[0],
                label: "Roles create interaction boundaries",
                evidenceKind: "inference",
              },
            ],
          },
        },
      },
    },
    "map",
  );
  await page.locator(".react-flow__edge").first().waitFor();
  await page
    .locator(".react-flow__edge")
    .first()
    .evaluate((el) =>
      el.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    );
  await expect(page.locator(".connection-title")).toHaveText(
    "Roles create interaction boundaries",
  );
  await expect(page.locator(".connection-endpoints button")).toHaveCount(2);
  await expect(
    page.getByText("Go inferred this relationship", { exact: true }),
  ).toBeVisible();
  await page.clock.runFor(800);
  await page.screenshot({
    path: "test-results/connection-drawer-inferred.png",
  });
  const sessionPreviews = Object.fromEntries(
    Array.from({ length: 20 }, (_, i) => {
      const sid = `preview-${i}`;
      return [
        sid,
        {
          ...session,
          id: sid,
          title: `Older rabbit hole ${i}`,
          createdAt: new Date(Date.UTC(2020, 0, i + 1, 12)).toISOString(),
          updatedAt: "2026-10-29T12:00:00Z",
        },
      ];
    }),
  );
  await seed({
    sessions: { s1: session, ...sessionPreviews },
    sessionLastUsed: { "preview-0": "2030-01-01T12:00:00Z" },
  });
  await page
    .getByRole("button", { name: "Switch rabbit hole", exact: true })
    .click();
  const previews = page.locator(".session-previews");
  await expect(previews.locator('[role="menuitem"]')).toHaveCount(21);
  await expect(previews.locator('[role="menuitem"]').first()).toContainText(
    "Older rabbit hole 0",
  );
  await expect(previews.locator("time").first()).toHaveAttribute(
    "datetime",
    "2020-01-01T12:00:00.000Z",
  );
  expect(
    await previews.evaluate(
      (el) => el.scrollHeight > el.clientHeight && el.clientHeight <= 8 * 70,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/session-previews.png" });
  await page.keyboard.press("Escape");
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
    await page
      .getByRole("button", { name: "Add questions", exact: true })
      .click();
    await page.getByLabel("Number of new questions").fill("4");
    await expect(page.getByLabel("Medium — apply")).toBeChecked();
    await shot("question-request", scheme);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
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
      page.getByRole("heading", { name: /No unanswered original questions/ }),
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
    const shared = page.getByRole("switch", {
      name: "Use these preferences for all rabbit holes",
      exact: true,
    });
    await shared.click();
    await expect(shared).toBeChecked();
    await expect
      .poll(() =>
        worker.evaluate(
          async () =>
            ((await chrome.storage.local.get("state")).state as any)
              .shareSessionPreferences,
        ),
      )
      .toBe(true);
    await shot("shared-preferences", scheme);
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
    await seed(
      {
        sessions: {
          s1: {
            ...session,
            captures: [{ ...capture("c1"), tag: "none", references: [] }],
            processed: ["c1"],
          },
        },
      },
      "map",
    );
    await page.locator('.react-flow__node[data-id="n1"]').click();
    await expect(page.locator(".drawer-links")).toContainText("1 source page");
    await shot("connection-strength", scheme);
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
    const hiddenCapture = { ...capture("c1"), tag: "none", references: [] };
    await seed(
      {
        sessions: {
          s1: { ...session, captures: [hiddenCapture], hidden: ["c1"] },
        },
      },
      "sources",
    );
    await page
      .getByRole("button", { name: "Find actions", exact: true })
      .click();
    await expect(
      page.getByRole("menuitem", { name: "Show on map again", exact: true }),
    ).toBeEnabled();
    expect(
      await page
        .locator(".stop.is-hidden .stop-body")
        .evaluate((el) => getComputedStyle(el).opacity),
    ).toBe("1");
    await shot("hidden-find-menu", scheme);
    await page.keyboard.press("Escape");
    const expansion = page.locator(".capture-details summary").first();
    await expansion.click();
    await expect(page.locator(".capture-details[open]").first()).toBeVisible();
    await expect(expansion.locator("svg")).toHaveCount(1);
    await shot("source-expander", scheme);
    await expansion.press("Enter");
    await expect(page.locator(".capture-details[open]")).toHaveCount(0);
    await seed(
      { sessions: { s1: { ...session, analysis: { ...a, edges: [] } } } },
      "map",
    );
    await expect(
      page.getByText("No connections saved yet", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".react-flow__node")).toHaveCount(4);
    await expect
      .poll(
        async () =>
          new Set(
            await page
              .locator(".react-flow__node")
              .evaluateAll((nodes) =>
                nodes.map((n) => n.getBoundingClientRect().x),
              ),
          ).size,
      )
      .toBeGreaterThan(1);
    await shot("unconnected-map", scheme);
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
      await expect(page.locator(".handoff-failed")).toContainText(
        "Your map hasn't changed. None of the sent finds are waiting now.",
      );
      await expect(
        page
          .locator(".handoff-failed")
          .getByRole("button", { name: "Send again", exact: true }),
      ).toBeDisabled();
      await expect(
        page
          .locator(".handoff-failed")
          .getByRole("button", { name: "Copy details", exact: true }),
      ).toBeEnabled();
      await shot(`failed-${panel ? "panel" : "workspace"}`, scheme);
      await seed(
        {
          goCompletion: "quiet",
          sessions: {
            s1: {
              ...session,
              captures: [Capture.parse(capture("other"))],
              removed: ["c1", "c2"],
            },
          },
          handoffs: {
            s1: {
              ...hand,
              status: "failed",
              reason: "A sent find was deleted.",
            },
          },
        },
        "sources",
        panel,
      );
      await expect(page.locator(".handoff-failed")).toContainText(
        "None of the sent finds are waiting now.",
      );
      await expect(
        page
          .locator(".handoff-failed")
          .getByRole("button", { name: "Send again", exact: true }),
      ).toBeEnabled();
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
