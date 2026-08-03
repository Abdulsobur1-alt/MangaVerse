# MangaVerse — Deployment Guide

This guide walks you through shipping MangaVerse (Next.js web + Express API + PostgreSQL + Redis + Meilisearch + Expo mobile) to production. It covers the recommended **single-VPS with Docker Compose** path (free-tier friendly) and notes managed alternatives.

---

## Architecture

| Component     | Where          | Port (host) | Notes                                        |
| ------------- | -------------- | ----------- | -------------------------------------------- |
| Web (Next.js) | `apps/web`     | 3000        | Standalone output, served by `node server.js` |
| API + workers | `apps/api`     | 3001        | Express + BullMQ scraper/prediction workers   |
| PostgreSQL    | docker-compose | 5432        | Primary database                              |
| Redis         | docker-compose | 6379        | Caching + BullMQ queues                       |
| Meilisearch   | docker-compose | 7700        | Full-text search                              |
| Caddy         | docker-compose | 80 / 443    | Reverse proxy + automatic HTTPS               |
| Mobile (Expo) | `apps/mobile`  | —           | EAS Build → APK / Play Store                  |

The API auto-seeds content: on first boot its scraper worker enqueues a `seed-database` job (fires ~30s after startup) that pulls popular/latest titles + chapters from MangaDex. No manual seeding needed for a demo.

---

## Option A — Single VPS with Docker Compose (recommended, ~$0–25/mo)

### 1. Get a VPS

Pick any provider; Oracle Cloud's **Always Free tier** runs the whole stack at $0:

- **Oracle Cloud Always Free** (free): Ampere A1 VM — up to 4 OCPU + 24 GB RAM. Create an account → Compute → Instances → "Create instance" → choose **Ampere** shape (VM.Standard.A1.Flex, 4 OCPU / 24 GB), Ubuntu 22.04 (or 24.04). Open ports **22, 80, 443** (and 3000/3001 only if you want direct access) in the security list / iptables.
- **Hetzner CX32 / DigitalOcean droplet** (~$15–25/mo): 4 vCPU / 8 GB is comfortable.

> ⚠️ On Oracle free tier, the instance uses an ephemeral boot disk — add a **block volume** and back up `postgres_data` (see [Backups](#backups)).

### 2. Install Docker on the VPS

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### 3. Clone and configure

```bash
git clone https://github.com/<you>/mangaverse.git
cd mangaverse
```

Create the root `.env` (the compose file reads it). There is no committed root `.env.example` — the per-app templates live in `apps/*/.env.example` (they're for local dev). For Docker, create `.env` in the repo root with the contents below:

```dotenv
# ── Firebase (production auth) ──────────────────────────
# Create a project at https://console.firebase.google.com →
# Authentication → enable Email/Password. Then generate a
# service-account key (Project settings → Service accounts →
# Generate new private key) and paste its JSON here:
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"mangaverse-xxxx","private_key":"-----BEGIN PRIVATE KEY-----...","client_email":"firebase-adminsdk-xxxx@mangaverse-xxxx.iam.gserviceaccount.com",...}

# ── Web push (VAPID) ────────────────────────────────────
# Generate locally with:  pnpm --filter @mangaverse/api webpush:generate-keys
# then paste the two keys here:
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# ── Web (inlined at build time) ─────────────────────────
NEXT_PUBLIC_API_URL=https://api.YOUR-DOMAIN.com/api
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...   # from Firebase → Project settings → Web API key

# ── Domain (used by Caddy for auto-HTTPS) ───────────────
# DOMAIN=YOUR-DOMAIN.com

# ── Databases (defaults are fine) ───────────────────────
# POSTGRES_PASSWORD=postgres
# MEILI_MASTER_KEY=mangaverse-dev-key
# CORS_ORIGIN=*
```

### 4. Point DNS at the VPS

Create two **A records** at your DNS provider, both → your VPS IP:

```
YOUR-DOMAIN.com   A  <vps-ip>
api.YOUR-DOMAIN.com   A  <vps-ip>
```

### 5. Launch the stack

```bash
docker compose up -d --build
docker compose ps
```

> **Security note before going public:** the compose file exposes the API on host port `3001` (and web on `3000`) for easy LAN/demo access. When you go fully public, set `CORS_ORIGIN` to your real web origin instead of `*`, and consider removing the `3000`/`3001` host ports so traffic flows only through Caddy (80/443).

> ⚠️ **`NEXT_PUBLIC_API_URL` is baked into the web image at build time** — its compose default is `http://localhost:3001/api`, fine for a LAN demo but wrong for a public deploy (browsers would call *their own* localhost and every API request would fail). Set it to `https://api.YOUR-DOMAIN.com/api` in the root `.env` **before** the first `docker compose up -d --build`; changing it later requires `docker compose build web` to re-inline it.

Caddy automatically obtains and renews Let's Encrypt certificates for `YOUR-DOMAIN.com` and `api.YOUR-DOMAIN.com`. If `DOMAIN` is unset, Caddy serves `https://localhost` with an internal CA (fine for local demos).

Verify:

```bash
curl https://YOUR-DOMAIN.com/api/health
# → {"success":true,"data":{"status":"ok",...}}

curl https://api.YOUR-DOMAIN.com/api/health
```

### 6. Make yourself an admin

The API applies migrations on startup (`prisma migrate deploy`) and seeds content automatically. To grant your Firebase account the admin role:

```bash
# Find your DB user id by email:
docker compose exec api sh -c "npx prisma db execute --stdin" <<'SQL'
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
SQL
```

(Or run a one-off query via `docker compose exec postgres psql -U postgres mangaverse`.)

---

## Option B — Managed platforms (Render / Railway)

The same Dockerfiles work on Render (Blueprint) or Railway. Point each service at its Dockerfile with the repo root as build context:

- `apps/api/Dockerfile` — Express API + workers (a `worker` service can share the image with a different command).
- `apps/web/Dockerfile` — Next.js web.
- Managed PostgreSQL, Redis, and Meilisearch instances; set the same env vars as the compose file.

Expect ~$40–80/mo all-in vs. the ~$0–25 VPS.

---

## Option C — Render + Supabase (free, no credit card)

This path costs **nothing and requires no credit card** — ideal if you can't provision a VPS. It uses a `render.yaml` Blueprint (committed to the repo) to deploy the API and web on Render's free tier, with **Supabase** as the database and **Upstash** as Redis.

### Free-tier realities (read before you start)

- **Sleeps after 15 min of inactivity** (~1 min cold start on the next visit). A sleeping service is free — you only consume instance hours while awake.
- **750 free instance-hours/month** shared across the whole workspace. With two services that only wake on traffic, a low-traffic demo stays well within limits.
- **Ephemeral filesystem** — nothing persists on the server's local disk.
- **No Meilisearch on free tier** — search automatically falls back to database queries (the API handles this).
- **Redis is optional but recommended** — without it the scraper seed job never runs and the database stays empty. Upstash's free tier (256 MB, 500k commands/mo) is the zero-cost fix.

### 1. Create the services (all free, no card)

**Supabase** → [supabase.com](https://supabase.com) → New project:
1. Project settings → **Database → Connection string** → copy the **Session pooler** URI (port `5432`, includes `?pgbouncer=true`).
2. Save it as `DATABASE_URL`. (Use session pooler, not transaction — Prisma migrations need session mode.)

> ⚠️ **Use the Session pooler URI, NOT the direct connection.** The direct-connection string (host `db.<ref>.supabase.co:5432`) resolves to **IPv6-only** (no IPv4 A record), and Render's free tier has no IPv6 egress — so `prisma migrate deploy` fails at boot with `Error: P1001: Can't reach database server`. If the dashboard value was pasted from "Direct connection", swap it for the Session pooler URI (`postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`) and URL-encode any special characters in the password (`@` → `%40`).

**Upstash** → [upstash.com](https://upstash.com) → Create a free Redis database:
1. Copy the **REST/TLS** URL (`rediss://default:<password>@<host>.upstash.io:6379`).
2. Save it as `REDIS_URL`. (The API already speaks TLS via ioredis.)

**Firebase (optional)** — only if you want real auth: Web API key → `NEXT_PUBLIC_FIREBASE_API_KEY`, service-account JSON → `FIREBASE_SERVICE_ACCOUNT`. Without it the app runs in dev mode (`dev_` tokens).

### 2. Deploy on Render

1. Push this repo to GitHub (already done — `render.yaml` lives at the root).
2. [render.com](https://render.com) → sign up with GitHub (no card) → **New → Blueprint**.
3. Pick the MangaVerse repo → Render reads `render.yaml` and creates **mangaverse-api** + **mangaverse-web**.
4. In the **Environment** tab of each service, fill the `sync: false` secrets **before the first deploy** (a blank `DATABASE_URL` makes `prisma migrate deploy` fail on boot):
   - `mangaverse-api`: `DATABASE_URL`, `REDIS_URL`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `FIREBASE_SERVICE_ACCOUNT`
   - `mangaverse-web`: `NEXT_PUBLIC_FIREBASE_API_KEY`
5. **Deploy**. The API runs `prisma migrate deploy` on boot (creates the schema), then the scraper worker seeds ~100 titles from MangaDex 30 s later. Watch `mangaverse-api` logs for `🌱 Seeding database`.

> ⚠️ **Service names must be unique on Render.** The URLs above assume the services are literally named `mangaverse-api` / `mangaverse-web`. If Render assigns a suffix because a name is taken, update both `NEXT_PUBLIC_API_URL` and `CORS_ORIGIN` in `render.yaml` to match.
> ⚠️ **Supabase + Prisma over SSL.** If migrations fail with SSL errors, append `?sslmode=require` to the `DATABASE_URL` (newer Supabase regions require TLS).
> ⚠️ **Free-tier build memory.** Render free instances have 512 MB RAM; the web build (`pnpm install` of ~1190 packages + Next standalone) can OOM. If the build dies, re-run it — the pnpm store cache mount makes retries cheap — or pause the API service while the web builds. If it *keeps* dying, the reliable escape hatch is to build both images locally and push them to Docker Hub, then switch the services in `render.yaml` to `image:` (dropping `dockerContext`/`dockerfilePath`).

### 3. Verify

```bash
curl https://mangaverse-api.onrender.com/api/health
```

The web app is at `https://mangaverse-web.onrender.com` and calls `https://mangaverse-api.onrender.com/api` (already wired via `NEXT_PUBLIC_API_URL` in `render.yaml`).

> Note: changing any `NEXT_PUBLIC_*` value later requires a **Manual Deploy → Deploy** (a plain restart won't do — the value is inlined at build time).

### 4. Known limitations on free tier

- **Cold starts**: the first request after idle takes ~1 min (Render shows a loading page meanwhile).
- **Workers sleep too**: the scraper/predictions workers only run while the API is awake. Prediction resolution also happens lazily on reads, so due markets still resolve.
- **No custom domain** on free tier — you get `<service>.onrender.com` URLs. The mobile app's `EXPO_PUBLIC_API_URL` can point straight at `https://mangaverse-api.onrender.com`.
- **Upstash command budget** — BullMQ's background polling counts against the free 500k commands/month. Fine for a low-traffic demo; a constantly-hit API will burn through it (then queues degrade to no-op until next month).
- **The seed job re-runs on every cold start** — `index.ts` re-adds `seed-database` each time the service wakes from its 15-min sleep. It's idempotent (upserts), so don't be alarmed by repeated `🌱 Seeding database` lines in the logs.
- **Supabase pauses after 7 days of no DB activity** (one click to unpause; data is kept).
- **750 hours/month cap** — if you see "suspended until next month", you hit the free-tier ceiling; the app wakes up again on the 1st.

---

## Firebase setup (production auth)

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication → Sign-in method → Email/Password → Enable**.
3. **Project settings → Your apps → Web app** → copy the **Web API key** → `NEXT_PUBLIC_FIREBASE_API_KEY` / `EXPO_PUBLIC_FIREBASE_API_KEY`.
4. **Project settings → Service accounts → Generate new private key** → paste the JSON into `FIREBASE_SERVICE_ACCOUNT` (API container only; it's never exposed client-side).

Without Firebase configured, the app runs in dev mode (`dev_` tokens) — useful for local work but **not** for production.

## Web push (VAPID)

```bash
pnpm --filter @mangaverse/api webpush:generate-keys
```

Paste the printed `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` into the API env. Skip if you don't need browser push.

---

## Mobile — APK now, Play Store later

### Build a shareable APK (fastest way to see it on a phone)

1. Install EAS CLI: `npm i -g eas-cli` and log in: `eas login`.
2. From `apps/mobile`:
   ```bash
   eas build --platform android --profile preview
   ```
   The `preview` profile already builds an **APK** with `EXPO_PUBLIC_API_URL=https://api.YOUR-DOMAIN.com` (update `apps/mobile/eas.json` to your API domain). EAS prints an install link + QR code.
   Commit the built APK as `apps/api/public/mangaverse-v0.1.0.apk` — the web download page (`/download`) links to it via `/api/download/` (the web proxies `/api/*` to the API, which serves `apps/api/public/`). Until that file exists in the repo, the download button 404s.
3. On the phone: enable "Install unknown apps", open the link, install, sign in.

### Play Store release

```bash
eas build --platform android --profile production   # produces an .aab
eas submit --platform android                       # uploads to Play Console ($25 one-time fee)
```

Notes:
- Keep `runtimeVersion` aligned with native builds if you adopt **EAS Update** for over-the-air JS updates later (JS-only fixes skip the store review).
- iOS builds (`eas build --platform ios --profile production`) require an Apple Developer account ($99/yr) and run through TestFlight/App Store review.

---

## Operations

### Logs

```bash
docker compose logs -f api        # API + workers
docker compose logs -f web        # web
docker compose logs -f caddy      # proxy/HTTPS
```

### Backups (do this from day one)

```bash
docker compose exec postgres pg_dump -U postgres mangaverse > backup-$(date +%F).sql
```

Copy the dump off the VPS (SCP/rclone to object storage). Restore with `psql -U postgres mangaverse < backup.sql`.

### Updating

```bash
git pull
docker compose up -d --build
```

### Common issues

- **Prisma migration fails on first boot** — the API waits on the healthy Postgres container (`depends_on.condition: service_healthy`); if the DB was created with `db push` during dev, `prisma migrate deploy` on an existing DB with an empty `_prisma_migrations` table may report drift. Safe reset for a fresh deploy: `docker compose down -v && docker compose up -d --build` (wipes data).
- **No content after boot** — wait ~1 min; the scraper seed job runs 30s after start. Confirm Redis is up: `docker compose ps redis`.
- **HTTPS cert not issuing** — check DNS A records propagate (`dig YOUR-DOMAIN.com`), then `docker compose logs caddy`.

---

## Known residual risks (Phase 34)

These are the paths that were **never end-to-end validated on the dev machine** — everything else in this guide has been exercised locally. They are believed correct, but if you hit one of them in production, the fix is noted next to each:

- **`pnpm install` inside the build container depends on registry.npmjs.org reachability.** During Phase 34 validation, the Docker VM repeatedly timed out fetching from npm (~25–58 s per request, aborting around 5 min) while Docker Hub pulls worked — an environmental network issue, not a Dockerfile bug. Mitigations already in place: `.npmrc` fetch-retry settings, and a pnpm-store BuildKit cache mount (`--mount=type=cache,target=/root/.local/share/pnpm/store`) in both Dockerfiles so retries reuse downloaded tarballs instead of re-fetching all ~1190 lockfile entries. **If the first build fails at `pnpm install`, simply re-run `docker compose up -d --build` — the warm cache makes the retry substantially faster.**
- **Web standalone layout is inferred, not yet confirmed by a complete build.** The nested runtime path (`.next/standalone/apps/web/server.js`) is *inferred* from `outputFileTracingRoot` being pinned to the repo root in `apps/web/next.config.ts`; it was never observed in a complete build — the only local standalone output is a partial Windows build (no `server.js`; see the Windows note below). The Dockerfile therefore has a **fail-fast guard** in its build stage: if the entrypoint isn't exactly at `apps/web/server.js`, the image build stops with a clear message instead of shipping a container that crashes at boot. If you see that guard fire, the standalone layout changed (e.g., a Next major upgrade) — re-run `next build`, inspect `.next/standalone/`, and update the Dockerfile paths.
- **`@mangaverse/shared` tracing into the standalone output.** The web app imports the workspace package `@mangaverse/shared` (a pnpm store symlink). With the tracing root at the repo root this is inside the traced set, but it is unverified in a real Linux build. If the web container starts but pages that import `@mangaverse/shared` 500, the traced copy of that package is missing/broken — rebuild with `outputFileTracingRoot` set and inspect `.next/standalone/apps/web/node_modules/@mangaverse/shared`.
- **Prisma engines are downloaded at install time.** `@prisma/engines`, `prisma`, and `@prisma/client` are approved in `pnpm-workspace.yaml` → `allowBuilds` (pnpm v11 replaced `onlyBuiltDependencies` with this map), so their postinstall scripts run during `pnpm install` and fetch the engine binaries from `binaries.prisma.sh`. That download is the same flaky-network class of failure as the rest of the install — retry works the same way (BuildKit caches the layer and the store). The engines then live in the copied root `node_modules` (`.pnpm` store), so `prisma migrate deploy` at runtime is offline.
- **Local `next build` now fails on Windows.** `output: 'standalone'` makes Next create symlinks into the pnpm store during tracing, which Windows blocks with `EPERM: operation not permitted` unless Developer Mode is enabled. This does **not** affect the Linux Docker build. For local production-build checks on Windows: enable Developer Mode (`Settings → Privacy & security → For developers`), or build inside WSL/Docker.
- **API runner dependency layout.** The runner copies both the root `node_modules` (the `.pnpm` virtual store, which also contains the generated `@prisma/client`) **and** the per-package `apps/api/node_modules` (pnpm does **not** hoist bare package names like `express`/`ioredis` to the workspace root — `node` resolves the app's deps from here via relative symlinks). Validated with a staged host-side simulation; the image was never booted. If the API exits with `ERR_MODULE_NOT_FOUND: Cannot find package 'express'`, the per-package copy is missing from `apps/api/Dockerfile`.
- **First-boot flow** (`npx prisma migrate deploy` → `node dist/index.js` + BullMQ workers → 30 s seed job) was only covered by running the infra containers locally, not the built images. Watch `docker compose logs -f api` for the first minute.

If your VPS build fails in a way not covered above, open an issue with the full `docker compose build` log — but try the build once more first; the store cache turns most flaky-network failures into a no-op retry.

---

## Local development (unchanged)

```bash
pnpm install
docker compose up -d postgres redis meilisearch   # infra only
pnpm dev                                          # turbo: web (3000) + api (3001)
```

Copy `apps/api/.env.example` → `apps/api/.env`, `apps/web/.env.example` → `apps/web/.env.local`, `apps/mobile/.env.example` → `apps/mobile/.env` as needed.
