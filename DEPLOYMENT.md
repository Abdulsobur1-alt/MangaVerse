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
- **Prisma engines are downloaded during the API build stage, not at install.** Because `ignore-scripts=true` skips `@prisma/engines`' postinstall, `prisma generate` fetches the engine binaries on demand from `binaries.prisma.sh` during `pnpm --filter @mangaverse/api build`. That is the same flaky-network class of failure as the `pnpm install` timeouts — it can fail the *build stage* even when install succeeded. The build stage now caches that download (`--mount=type=cache,target=/root/.cache/prisma`), so a retry after a failed download reuses the partial cache. The engines then live in the copied root `node_modules` (`.pnpm` store), so `prisma migrate deploy` at runtime is offline. (Optional: if you prefer engines at install time, `"pnpm": { "onlyBuiltDependencies": ["@prisma/engines"] }` in the root `package.json` *may* allow that one package's postinstall even with `ignore-scripts=true` — verify on your pnpm version first.)
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
