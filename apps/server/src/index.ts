import { Store } from "./store";
import { createApp } from "./app";
const users = JSON.parse(process.env.RABBITHOLE_USERS ?? "[]") as {
  owner: string;
  token: string;
}[];
if (
  !users.length ||
  users.some(
    (u) =>
      !u.owner ||
      !u.token ||
      u.token.length < 32 ||
      u.token.startsWith("REPLACE"),
  )
)
  throw new Error(
    "Configure RABBITHOLE_USERS with a personal random token (32+ characters); see .env.example",
  );
const store = new Store(
  process.env.DATABASE_PATH ?? "./data/rabbithole.sqlite",
);
const port = Number(process.env.PORT ?? 3210);
createApp(store, users).listen(port, "0.0.0.0", () =>
  console.info(
    `RabbitHole listening on port ${port}; authenticated API and /mcp ready`,
  ),
);
