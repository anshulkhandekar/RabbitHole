# Backend deployment

Use a single Render Node web service with a persistent disk. This keeps the explanation small: authenticated HTTP tools plus durable SQLite. A paid service/disk is required; review Render's actual plan and price before provisioning. This repository does not incur hosting charges by itself.

1. Connect the owner-approved repository in Render. Repository visibility is a separate owner decision; deployment does not require making it public.
2. In Render, connect the private repository and create a Blueprint from `render.yaml`. Review the service plan and disk cost before confirming.
3. The Blueprint generates `RABBITHOLE_TOKEN` on Render and sets `RABBITHOLE_OWNER=anshul`. In a manual service form, use Generate for the token; keep it private. Multi-owner deployments can instead use the `RABBITHOLE_USERS` JSON array in `.env.example`. No local credential needs to be uploaded to Render.
4. Confirm `DATABASE_PATH=/var/data/rabbithole.sqlite` and a mounted persistent disk at `/var/data`. Never use free/ephemeral disk for the database.
5. Wait for the `/health` check. Configure the extension with the service origin and configure Go with its `/mcp` endpoint.
6. Test unauthorized requests (401), capture sync, Go read/write, restart persistence, then incremental processing. Deployment is unverified until those checks actually run.

One process/instance writes SQLite. Do not horizontally scale this deployment. The schema initializes idempotently on startup. Before schema changes, take a backup. Use SQLite's online backup API or a host snapshot; copying only the main database while its WAL is active is not a dependable backup.

The token workflow is a prototype compromise: no OAuth login, end-user sign-up, automatic provisioning, or account recovery. Give judges an isolated owner/token if needed, using synthetic/public demo sources. Sharing the agent does not provision backend access or install the extension.

For local use: `npm run setup:local`, `npm start`. Local backend data persists under ignored `data/`. The local backend works with the extension, but Go requires public HTTPS access. Do not describe the localhost setup as a verified Go integration.

## Manual dashboard setup

Connecting the repository in Render’s Web Service wizard does not automatically apply render.yaml. Copy the build command, Node version, environment variables, disk mount, database path, and health check explicitly, or create the service as a Blueprint instead. Use `npm ci --include=dev && npm run build`, not the autofilled `npm install; npm run build`: npm ci clears native dependency binaries cached under a different Node version. After changing NODE_VERSION, rebuild before testing startup.

## Release checks

Confirm the exact deployed commit, health, unauthorized request rejection, authenticated sync and persistence after restart. A previous live deployment is not verification of the current branch. The user reported a Render update at 12:24 CDT on October 29; later Go quotation failure still needs the new recovery-instruction live rerun.

Merging/deploying updates server code only. Reload the extension and refresh research tabs after a local build; paste canonical agent Instructions separately. The current connector stays at schema 8 and requires no release for instruction/UI-only changes. See [release checklist](release-checklist.md).
