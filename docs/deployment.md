# Backend deployment

Use a single Render Node web service with a persistent disk. This keeps the explanation small: authenticated HTTP tools plus durable SQLite. A paid service/disk is required; review Render's actual plan and price before provisioning. This repository does not incur hosting charges by itself.

1. Use the **private** repository at https://github.com/anshulkhandekar/RabbitHole. Do not make it public. This project is prepared with `origin` pointing to that repository.
2. In Render, connect the private repository and create a Blueprint from `render.yaml`. Review the service plan and disk cost before confirming.
3. The Blueprint generates `RABBITHOLE_TOKEN` on Render and sets `RABBITHOLE_OWNER=anshul`. In a manual service form, use Generate for the token; keep it private. Multi-owner deployments can instead use the `RABBITHOLE_USERS` JSON array in `.env.example`. No local credential needs to be uploaded to Render.
4. Confirm `DATABASE_PATH=/var/data/rabbithole.sqlite` and a mounted persistent disk at `/var/data`. Never use free/ephemeral disk for the database.
5. Wait for the `/health` check. Configure the extension with the service origin and configure Go with its `/mcp` endpoint.
6. Test unauthorized requests (401), capture sync, Go read/write, restart persistence, then incremental processing. Deployment is unverified until those checks actually run.

One process/instance writes SQLite. Do not horizontally scale this deployment. The schema initializes idempotently on startup. Before schema changes, take a backup. Use SQLite's online backup API or a host snapshot; copying only the main database while its WAL is active is not a dependable backup.

The token workflow is a prototype compromise: no OAuth login, end-user sign-up, automatic provisioning, or account recovery. Give judges an isolated owner/token if needed, using synthetic/public demo sources. Sharing the agent does not provision backend access or install the extension.

For local use: `npm run setup:local`, `npm start`. Local backend data persists under ignored `data/`. The local backend works with the extension, but Go requires public HTTPS access. Do not describe the localhost setup as a verified Go integration.
