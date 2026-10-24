import { build } from "esbuild";
import { mkdir, writeFile, copyFile, rm } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist/extension", { recursive: true });
await build({
  entryPoints: ["apps/extension/src/ui.tsx"],
  bundle: true,
  outdir: "dist/extension",
  format: "esm",
  target: "chrome120",
  minify: true,
});
await build({
  entryPoints: {
    background: "apps/extension/src/background.ts",
    content: "apps/extension/src/content.ts",
  },
  bundle: true,
  outdir: "dist/extension",
  format: "iife",
  target: "chrome120",
  minify: true,
});
await copyFile("apps/extension/manifest.json", "dist/extension/manifest.json");
await writeFile(
  "dist/extension/index.html",
  '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RabbitHole · make connections</title><link rel="stylesheet" href="ui.css"></head><body><div id="root"></div><script type="module" src="ui.js"></script></body></html>',
);

await copyFile(
  "THIRD_PARTY_LICENSES.txt",
  "dist/extension/THIRD_PARTY_LICENSES.txt",
);
