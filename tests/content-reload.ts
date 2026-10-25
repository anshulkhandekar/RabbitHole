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

// Isolated synthetic profile: never touches the installed extension or real sessions.
const profile = mkdtempSync(tmpdir() + "/rabbithole-reload-");
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
  const worker =
    browser.serviceWorkers()[0] ??
    (await browser.waitForEvent("serviceworker"));
  const extensionId = new URL(worker.url()).host;
  const ui = await browser.newPage();
  await ui.goto(`chrome-extension://${extensionId}/index.html`);
  const research = await browser.newPage();
  const errors: string[] = [];
  research.on("pageerror", (error) => errors.push(error.message));
  await research.route("https://research.example/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Synthetic research</h1><p>A test article.</p>",
    }),
  );
  await research.goto("https://research.example/article");
  await research.bringToFront();
  const start = await ui.evaluate(() =>
    chrome.runtime.sendMessage({ type: "start" }),
  );
  assert.ok(start.active, JSON.stringify(start));
  await ui.evaluate(() => chrome.runtime.sendMessage({ type: "reading-mode" }));
  const indicator = research.locator("[data-rabbithole-reading]");
  await expect(indicator).toHaveCount(1);
  // Keep an ordinary page open across a genuine extension reload.
  await ui.close();
  await worker
    .evaluate(() => chrome.runtime.reload())
    .catch((error) => {
      if (!/closed|destroyed/i.test(String(error))) throw error;
    });
  await research.evaluate(() => window.dispatchEvent(new Event("popstate")));
  await expect(indicator).toHaveCount(0, { timeout: 10000 });
  // Remain on the orphaned page beyond another polling cycle: no repeated errors.
  await research.waitForTimeout(8000);
  assert.deepEqual(errors, []);
  console.log(
    "PASS actual extension invalidation via runtime.reload: stale indicator removed and no uncaught page errors across repeated polls.",
  );
} finally {
  await browser.close();
  rmSync(profile, { recursive: true, force: true });
}
