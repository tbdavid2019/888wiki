# Install 888wiki

[Project homepage](../README.md) · [Traditional Chinese](INSTALLATION.zh-TW.md) · [Feature guide](FEATURES.md) · [Changelog](../CHANGELOG.md)

## One-click deployment (recommended)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tbdavid2019/888wiki)

1. Select **Deploy to Cloudflare** and sign in to GitHub and Cloudflare.
2. Choose the GitHub repository and Worker names.
3. Set the three required secrets listed below in the setup flow or the Worker’s **Settings → Variables and Secrets**.
4. Start deployment. Cloudflare creates a repository copy, connects Workers Builds, and provisions the Cloudflare resources declared in `wrangler.toml`.
5. The deploy command initializes the configured D1 schemas, including the notes registry, accounts, history, statistics, and annotations. For an existing installation, follow the cutover procedure below before resuming traffic.

Cloudflare Deploy reads `wrangler.toml` for resource bindings and `.dev.vars.example` for secret names. Most runtime variables already have usable defaults, so you do not need to enter every row during setup. The tables below show every value that can affect a fresh deployment.

## Required secrets

| Secret | Purpose | Setup |
| --- | --- | --- |
| `SCN_SALT` | Salt for password hashing | Generate a unique random value for this installation. |
| `SCN_SECRET` | Signs sessions and authentication tokens | Generate a separate unique random value. |
| `SCN_ADMIN_PW` | Password for the admin dashboard | Choose a strong password. The dashboard path is `/admin` by default. |

Generate two separate random values for `SCN_SALT` and `SCN_SECRET` with `openssl rand -hex 32`; choose a strong password for `SCN_ADMIN_PW`.

Set secrets in Cloudflare’s setup flow or add them after deployment under **Worker → Settings → Variables and Secrets**. For Wrangler deployments, run `npx wrangler secret put <NAME>` for each required secret. Never put secret values in `wrangler.toml` or commit them to Git.

## Cloudflare resources created from `wrangler.toml`

| Binding | Resource | Used for |
| --- | --- | --- |
| `NOTES` | KV namespace | Note storage and fallback storage. |
| `SHARE` | KV namespace | Published notes and share metadata. |
| `NOTE_HISTORY_DB` | D1 database | Default notes registry, accounts, history, statistics, and annotations; other D1 bindings can split these roles. |
| `IMAGES` | R2 bucket | Uploaded images. The Worker serves images unless a custom domain is configured. |

The Worker also serves static files from `static/` and runs the configured daily cleanup Cron at 01:00 UTC (09:00 Taiwan time). Cloudflare provisions the resources and updates generated IDs from the default placeholders in the Wrangler file.

## Runtime variables and defaults

These values are already defined in `wrangler.toml`. Change them in your copied GitHub repository when you want different behavior; each push triggers the connected deployment.

| Variable | Default | Effect |
| --- | --- | --- |
| `SCN_STORAGE_DRIVER` | `auto` | Uses the available D1 notes registry; intentional `kv` mode disables accounts. Explicit D1 authority fails closed if its database is unavailable. |
| `SCN_APP_NAME` | `888wiki` | App name displayed in the interface. |
| `SCN_ADMIN_PATH` | `/admin` | Admin dashboard route. Choose a less predictable path if desired. |
| `SCN_SLUG_LENGTH` | `4` | Length of generated note URLs. |
| `SCN_ENABLE_R2` | `1` | `1` enables uploads to the provisioned R2 bucket; `0` disables uploads. |
| `SCN_R2_DOMAIN` | empty | Optional public image domain. Empty serves images through the Worker. |
| `SCN_GA_MEASUREMENT_ID` | empty | No analytics are sent until you provide a Google Analytics measurement ID. |
| `SCN_ENABLE_WEBTALK` | `0` | WebTalk is off until you configure your own service. |
| `SCN_WEBTALK_SCRIPT_URL` | empty | Your WebTalk client script URL. |
| `SCN_WEBTALK_AI_ENDPOINT` | empty | Your WebTalk AI endpoint. |
| `SCN_WEBTALK_SCOPE` | `meta` | WebTalk widget scope. |
| `SCN_WEBTALK_SITE_ID` | empty | Site ID registered with your WebTalk service. |
| `SCN_ENABLE_NOTE_HISTORY` | `1` | `1` enables D1 history; `0` disables it. D1 is also used for statistics and annotations. |
| `SCN_NOTE_HISTORY_LIMIT` | `10` | Maximum retained note history versions. |
| `SCN_NOTE_HISTORY_MIN_INTERVAL_SECONDS` | `300` | Minimum interval between automatic history snapshots. |
| `SCN_NOTES_DB_BINDING` | unset | Pin the authoritative notes D1 binding, for example `NOTE_HISTORY_DB`; a missing pinned binding returns `503 STORAGE_UNAVAILABLE`. |
| `SCN_REQUIRE_NOTES_REGISTRY` | unset | Set to `1` after a verified cutover to require the notes registry. |
| `SCN_LEGACY_HISTORY_RETENTION_DAYS` | `0` | Retention in days for untagged pre-cutover history; `0` disables cleanup. Untagged history is hidden from normal note history in registry mode. |
| `SCN_ENABLE_TURNSTILE` | `0` | Explicitly disables Turnstile; set to `1` only with both site key and secret configured. |
| `SCN_TURNSTILE_SITE_KEY` | empty | Public Turnstile site key, paired with the `SCN_TURNSTILE_SECRET` secret. |
| `SCN_TURNSTILE_FAIL_OPEN` | `1` | Controls legacy interactive protection fallback; Passkey registration verification remains strict. |

## Optional parameters and integrations

| Parameter | Default | Configure it when |
| --- | --- | --- |
| `GROQ_API_KEY` secret | Unset | Enable Groq-powered AI features and primary audio transcription. Without it, configured Workers AI can provide supported AI operations and the transcription fallback. |
| `SCN_R2_DOMAIN` | Empty | Serve uploaded images from your own public domain instead of the Worker. |
| `SCN_GA_MEASUREMENT_ID` | Unset | Send analytics to your own Google Analytics property. |
| `SCN_ENABLE_WEBTALK` | `0` | Set to `1` after configuring every WebTalk value below. |
| `SCN_WEBTALK_SCRIPT_URL` | Empty | Load your WebTalk client script. |
| `SCN_WEBTALK_AI_ENDPOINT` | Empty | Connect your WebTalk widget to your AI endpoint. |
| `SCN_WEBTALK_SCOPE` | `meta` | Change the DOM scope used by your WebTalk widget. |
| `SCN_WEBTALK_SITE_ID` | Empty | Identify your site to your WebTalk service. |
| Workers AI binding `AI` | Not configured | Use Cloudflare Workers AI for supported writing operations and as an audio-transcription fallback. Transcription tries Groq first when `GROQ_API_KEY` is set. Add the binding to `wrangler.toml`. |
| Worker custom domain | `workers.dev` URL | Use your own hostname. Configure it in the Cloudflare dashboard after deployment. |

WebTalk is disabled by default. Its script and endpoint are empty in the deployment configuration. Add values for a service you control before enabling it.

## Accounts and D1 bindings

Passkey accounts, My Space and Share Circles require an initialized notes registry and account database. In intentional pure KV mode (`SCN_STORAGE_DRIVER="kv"`, or fresh `auto` without D1 or registry requirements), account controls are hidden and anonymous notes continue working. A healthy notes registry without an account database keeps note integrity active but disables account APIs. Missing required schemas report `503 D1_SCHEMA_MISSING`. Set a stable `SCN_SECRET` as a secret; account operations fail closed without it.

Run `npm run db:init` for `wrangler.toml`, or `npm run db:init:owner` for `wrangler.owner.toml`. The deploy scripts run the corresponding initialization. The default single `NOTE_HISTORY_DB` can hold all roles. For split databases, configure `NOTES_DB` for notes, `APP_DB` for accounts and annotations, and optionally `NOTE_HISTORY_DB` for history; pin the notes binding with `SCN_NOTES_DB_BINDING`. Without a pin, notes resolve as `NOTES_DB`, then `NOTE_HISTORY_DB`, then `DB`; accounts and annotations use `APP_DB`, then `NOTE_HISTORY_DB`, and must share a database. Initialization targets each configured physical database. Use the matching `--config` and `--env` options for other Wrangler configurations.

Passkeys are bound to the site's WebAuthn relying-party domain (`rpId`); changing domains can leave existing credentials unusable on the new domain. Add another device's Passkey before losing access: there is no email, phone, or SSO recovery. Admin FIDO credentials are separate from account Passkeys and still use KV for their challenges and credentials; they do not inherit D1 account transaction guarantees.

Turnstile is off in the supplied configuration. To enable it, set `SCN_ENABLE_TURNSTILE="1"` and `SCN_TURNSTILE_SITE_KEY` together, and store `SCN_TURNSTILE_SECRET` with `npx wrangler secret put SCN_TURNSTILE_SECRET`. A partial configuration or unrecognized flag fails closed with `503`; explicit `0` or `false` disables it. Passkey registration uses strict single-use verification even when legacy fail-open is enabled.

Before rollout, inspect untracked owner configurations such as `wrangler.owner.toml` for plaintext `[vars]` API keys and credentials. Move them into `wrangler secret put <NAME> --config wrangler.owner.toml` bindings and rotate active non-session credentials. Rotate `SCN_SECRET` only if it was exposed: doing so intentionally invalidates prior anonymous annotation `deleteToken` HMACs and note/author cookies.

## Existing deployment: mandatory one-way registry cutover

Do not switch an active registry deployment back to unverified path-only KV. Back up the existing data and plan a maintenance window. KV has no atomic multi-key snapshot or cross-datacenter strong-consistency guarantee; pagination alone cannot establish that all earlier writes have settled.

1. Deploy the new enforcing Worker with `SCN_MAINTENANCE_MODE="1"`, blocking HTTP, API, MCP and scheduled operations, and drain in-flight requests for at least 60 seconds. Keep maintenance enabled throughout reconciliation.
2. Initialize the configured databases with `npm run db:init` (or `npm run db:init:owner`). Give the migration command a Cloudflare API token via `CLOUDFLARE_API_TOKEN` and the account ID via `CLOUDFLARE_ACCOUNT_ID` if not present in the config; use a token authorized to read the relevant KV namespaces and D1. Run `npm run db:migrate-legacy -- --audit` (add `--config wrangler.owner.toml` for the owner config). Review the two consecutive central KV snapshot stability passes, counts, differences, and conflict/promotion report; stop on any API error, truncated cursor, or unstable snapshot.
3. Only after explicitly confirming pre-maintenance KV writes have settled and reviewing the report, run `npm run db:migrate-legacy -- --confirm-quiesced-snapshot` with the same config. Resolve any conflicting security, publication, share mapping, or equal-timestamp content differences deliberately before retrying; the migration supports `--prefer=kv`, `--prefer=d1`, or `--resolve-stricter` when appropriate. Never proceed past an unresolved conflict.
4. Verify migrated note counts and active/terminal share registry parity. Set `SCN_NOTES_DB_BINDING` to the exact authoritative D1 binding and `SCN_REQUIRE_NOTES_REGISTRY="1"`, verify `/api/health` readiness, then clear maintenance mode. If that pinned binding is lost, requests fail closed with `503 STORAGE_UNAVAILABLE`, without falling back to KV or another D1 binding.


## Deploy with Wrangler

For a manual setup:

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/tbdavid2019/888wiki.git
   cd 888wiki
   npm install
   npx wrangler login
   ```

2. Create the KV namespaces and replace their `demo` IDs in `wrangler.toml` with the IDs Wrangler returns:

   ```bash
   npx wrangler kv namespace create NOTES
   npx wrangler kv namespace create SHARE
   ```

3. Create the D1 database and R2 bucket declared in `wrangler.toml`. Replace the D1 `database_id` with the returned ID:

   ```bash
   npx wrangler d1 create 888wiki-history
   npx wrangler r2 bucket create 888wiki-images
   ```

4. Add `SCN_SALT`, `SCN_SECRET`, and `SCN_ADMIN_PW` using `npx wrangler secret put <NAME>`. Add `GROQ_API_KEY` if you want Groq AI features.
5. Run the build, D1 initialization, and deployment:

   ```bash
   npm run deploy
   ```

Use unique secret values for every installation. See [Cloudflare Deploy to Cloudflare buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/) for the official deployment behavior.
