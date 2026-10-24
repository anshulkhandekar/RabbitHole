import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
const output = [];
async function visit(root) {
  for (const name of await readdir(root)) {
    if (name.startsWith(".")) continue;
    const path = join(root, name);
    if (name.startsWith("@")) {
      await visit(path);
      continue;
    }
    try {
      const meta = JSON.parse(
        await readFile(join(path, "package.json"), "utf8"),
      );
      const files = (await readdir(path)).filter((f) =>
        /^(licen[cs]e|notice)(\.|$)/i.test(f),
      );
      for (const file of files)
        output.push(
          `\n===== ${meta.name}@${meta.version} · ${file} =====\n${await readFile(join(path, file), "utf8")}`,
        );
    } catch {}
  }
}
await visit("node_modules");
await writeFile("THIRD_PARTY_LICENSES.txt", output.join("\n"));
console.log(`Collected ${output.length} installed license/notice files.`);
