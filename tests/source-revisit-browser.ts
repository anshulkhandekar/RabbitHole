// Isolated packaged-extension check for reopening sources and highlight Undo.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  cpSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const profile = mkdtempSync(tmpdir() + "/rabbithole-revisit-");
const extension = profile + "/extension";
cpSync(resolve("dist/extension"), extension, { recursive: true });
const manifest = JSON.parse(readFileSync(extension + "/manifest.json", "utf8"));
manifest.host_permissions = ["http://*/*", "https://*/*"];
writeFileSync(extension + "/manifest.json", JSON.stringify(manifest));
const browser = await chromium.launchPersistentContext(profile, {
  channel: "chromium",
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
  args: [
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
  ],
});
try {
  await browser.route("https://research.example/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><head><title>Revisited source</title></head><body><article><h1>Revisited source</h1><p id="passage">${"Independent operations can proceed together when their inputs are ready. ".repeat(12)}</p></article></body></html>`,
    }),
  );
  const worker =
    browser.serviceWorkers()[0] ??
    (await browser.waitForEvent("serviceworker"));
  const extensionUrl = new URL("index.html?workspace=1#sources", worker.url())
    .href;
  const ui = await browser.newPage();
  await ui.goto(extensionUrl);
  const original = await browser.newPage();
  await original.goto("https://research.example/article");
  await original.bringToFront();
  const started = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "start" }),
  );
  const id = started.active;
  assert.ok(id, JSON.stringify(started));
  const state = () =>
    ui.evaluate(() => chrome.runtime.sendMessage({ type: "state" }));
  await expect
    .poll(async () => (await state()).sessions[id].captures.length)
    .toBe(1);
  await ui.evaluate(
    (id) =>
      chrome.runtime.sendMessage({
        type: "patch",
        id,
        patch: { status: "paused" },
      }),
    id,
  );
  await original.close();
  await ui.bringToFront();
  await ui.reload();
  const opened = browser.waitForEvent("page");
  await ui.locator("a.stop-title").click();
  const research = await opened;
  await research.waitForURL("https://research.example/article");
  assert.equal((await state()).sessions[id].status, "paused");
  // Match the reported order: open the saved link first, then resume on that page.
  await research.bringToFront();
  await ui.evaluate(
    (id) =>
      chrome.runtime.sendMessage({
        type: "patch",
        id,
        patch: { status: "active" },
      }),
    id,
  );
  await expect
    .poll(async () =>
      worker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({
          active: true,
          lastFocusedWindow: true,
        });
        const local = (await chrome.storage.session.get("bindings"))
          .bindings as {
          tabs: Record<number, string>;
        };
        return local.tabs[tab.id!];
      }),
    )
    .toBe(id);
  await expect(research.locator("[data-rabbithole-reading]")).toBeVisible();
  await expect(
    research.getByRole("button", { name: "Include tab", exact: true }),
  ).toHaveCount(0);
  assert.equal(
    (await state()).sessions[id].captures.length,
    1,
    "reopening must not duplicate the saved article",
  );

  // Native user selection exercises automatic capture, including its confirmation.
  await research.locator("#passage").click({ clickCount: 3 });
  const undo = research.getByRole("button", {
    name: "Undo highlight save",
    exact: true,
  });
  await expect(undo).toBeVisible();
  await undo.click();
  await expect(
    research.getByText("Highlight removed", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        (await state()).sessions[id].captures.filter(
          (c: any) => c.sourceType === "highlight",
        ).length,
    )
    .toBe(0);
  await research.locator("#passage").click({ clickCount: 3 });
  await research.waitForTimeout(1200);
  assert.equal(
    (await state()).sessions[id].captures.filter(
      (c: any) => c.sourceType === "highlight",
    ).length,
    0,
    "automatic selection must not restore an undone highlight",
  );

  // An intentional manual save of that same passage is still allowed.
  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    await chrome.tabs.sendMessage(tab.id!, { type: "highlight" });
  });
  await expect(undo).toBeVisible();
  await undo.click();
  await expect
    .poll(
      async () =>
        (await state()).sessions[id].captures.filter(
          (c: any) => c.sourceType === "highlight",
        ).length,
    )
    .toBe(0);

  // A reopened Google URL can acquire different navigation parameters.
  let searchVisits = 0;
  await browser.route("https://www.google.com/search**", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("source") === "initial" && ++searchVisits > 1)
      return route.fulfill({
        contentType: "text/html",
        body: '<script>location.replace("https://www.google.com/search?q=how%20to%20optimize%20mac%20terminal&source=revisit&sei=changed")</script>',
      });
    return route.fulfill({
      contentType: "text/html",
      body: "<main>Search results</main>",
    });
  });
  await research.goto(
    "https://www.google.com/search?q=how+to+optimize+mac+terminal&source=initial",
  );
  const searches = async () =>
    (await state()).sessions[id].captures.filter(
      (c: any) => c.sourceType === "search",
    );
  await expect.poll(async () => (await searches()).length).toBe(1);
  await ui.evaluate(
    (id) =>
      chrome.runtime.sendMessage({
        type: "patch",
        id,
        patch: { status: "paused" },
      }),
    id,
  );
  await research.close();
  await ui.bringToFront();
  await ui.reload();
  const reopenedSearch = browser.waitForEvent("page");
  await ui.locator('a.stop-title[href*="google.com/search"]').click();
  const google = await reopenedSearch;
  await google.waitForURL(/source=revisit/);
  await google.bringToFront();
  await ui.evaluate(
    (id) =>
      chrome.runtime.sendMessage({
        type: "patch",
        id,
        patch: { status: "active" },
      }),
    id,
  );
  await expect(
    google.locator("[data-rabbithole-reading][data-edge]"),
  ).toBeVisible();
  await google.waitForTimeout(1500);
  assert.equal(
    (await searches()).length,
    1,
    "reopening a Google search after a URL parameter change must not add it again",
  );
  console.log(
    "PASS: saved source inclusion across resume; manual and automatic highlight Undo; reopened Google search deduplicates across changed URL parameters.",
  );
} finally {
  await browser.close();
  rmSync(profile, { recursive: true, force: true });
}
