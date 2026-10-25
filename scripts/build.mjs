import { build } from "esbuild";
import { mkdir, writeFile, copyFile, rm, cp, readFile } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist/extension", { recursive: true });
await build({
  entryPoints: ["apps/extension/src/ui.tsx"],
  bundle: true,
  outdir: "dist/extension",
  format: "esm",
  target: "chrome120",
  minify: true,
  loader: { ".woff2": "file" },
  assetNames: "fonts/[name]-[hash]",
  plugins: [
    {
      name: "local-fonts-only",
      setup(builder) {
        builder.onLoad(
          { filter: /styles\/tokens\.css$/ },
          async ({ path }) => ({
            contents: (await readFile(path, "utf8")).replace(
              /@import url\("https:\/\/fonts\.googleapis[^"]+"\);/,
              "",
            ),
            loader: "css",
          }),
        );
      },
    },
  ],
});
await build({
  entryPoints: {
    background: "apps/extension/src/background.ts",
    content: "apps/extension/src/content.ts",
  },
  bundle: true,
  outdir: "dist/extension",
  loader: { ".css": "text" },
  define: {
    __RABBIT_TOKENS__: JSON.stringify(
      (await readFile("apps/extension/src/styles/tokens.css", "utf8")).replace(
        /@import url\("https:\/\/fonts\.googleapis[^"]+"\);/,
        "",
      ),
    ),
  },
  format: "iife",
  target: "chrome120",
  minify: true,
});
await copyFile("apps/extension/manifest.json", "dist/extension/manifest.json");
await cp("apps/extension/public", "dist/extension", { recursive: true });
await writeFile(
  "dist/extension/index.html",
  '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RabbitHole · make connections</title><link rel="stylesheet" href="ui.css"></head><body><div id="root"></div><script type="module" src="ui.js"></script></body></html>',
);

await copyFile(
  "THIRD_PARTY_LICENSES.txt",
  "dist/extension/THIRD_PARTY_LICENSES.txt",
);
await mkdir("dist/server", { recursive: true });
await build({
  entryPoints: ["apps/server/src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: "dist/server/index.mjs",
  target: "node22",
});
