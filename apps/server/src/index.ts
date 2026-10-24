import { Store } from "./store";
import { createApp } from "./app";
import { getUsers } from "./config";
const users = getUsers();
const store = new Store(
  process.env.DATABASE_PATH ?? "./data/rabbithole.sqlite",
);
const port = Number(process.env.PORT ?? 3210);
createApp(store, users).listen(port, "0.0.0.0", () =>
  console.info(
    `RabbitHole listening on port ${port}; authenticated API and /mcp ready`,
  ),
);
