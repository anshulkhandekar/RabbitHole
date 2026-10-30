import { test } from "node:test";
import assert from "node:assert/strict";
import { worker } from "./worker-harness";

test("startup and starting research serialize persistent content-script registration", async () => {
  const app = worker({ id: 7, url: "https://example.org" });
  const registered = new Set<string>();
  let duplicates = 0;
  app.chrome.scripting.unregisterContentScripts = async () => {
    await new Promise((resolve) => setImmediate(resolve));
    registered.clear();
  };
  app.chrome.scripting.registerContentScripts = async (scripts: any) => {
    await new Promise((resolve) => setImmediate(resolve));
    for (const script of scripts) {
      if (registered.has(script.id)) duplicates++;
      registered.add(script.id);
    }
  };
  app.startup();
  await app.request("start");
  assert.equal(
    duplicates,
    0,
    "overlapping registrations would reject with Duplicate script ID",
  );
  assert.deepEqual([...registered], ["research"]);
});
