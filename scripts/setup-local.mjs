import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
const config = `PORT=3210\nDATABASE_PATH=./data/rabbithole.sqlite\nRABBITHOLE_USERS=${JSON.stringify([{ owner: "anshul", token: randomBytes(32).toString("hex") }])}\nPUBLIC_URL=http://localhost:3210\n`;
try {
  await writeFile(".env", config, { flag: "wx", mode: 0o600 });
  console.log(
    "Created ignored .env with a new personal token. Open .env locally to copy that token into extension Settings. Do not share it. Next: npm start",
  );
} catch (e) {
  if (e.code === "EEXIST")
    console.log(".env already exists; left it unchanged.");
  else throw e;
}
