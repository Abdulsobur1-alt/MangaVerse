# Launch Checklist — MangaVerse

## Security

- [ ] Supabase project: "Confirm email" decision made (currently OFF); password policy reviewed
- [ ] `SUPABASE_URL` uses the plain project URL (no `/rest/v1`)
- [ ] `DATABASE_URL` is the **Session pooler** URI (port 5432) — direct host is IPv6-only
- [ ] No secrets in the repo (`.env*` gitignored; Render env vars `sync: false`)
- [ ] API: helmet + CORS explicit origin + rate limit active (verified via headers)
- [ ] Web: security headers live (`curl -I https://mangaverse-web.onrender.com`)
- [ ] Admin roles assigned via console/SQL; impersonation is dev-only
- [ ] `pnpm audit` clean (or accepted risk documented)

## Performance

- [ ] Lighthouse ≥ 90 mobile / ≥ 95 desktop on `/`, `/browse`, `/title/[slug]`, reader
- [ ] LCP < 2.5 s, CLS < 0.1, INP < 200 ms on the 75th percentile
- [ ] Images served via the proxy with proper dimensions; no layout shift
- [ ] Sitemap + robots cached and reachable

## SEO

- [ ] `sitemap.xml` returns 200 and lists titles
- [ ] `robots.txt` correct
- [ ] OG/Twitter cards on key routes; canonical URLs
- [ ] JSON-LD (Book/Series) on title pages

## Accessibility

- [ ] axe pass on top routes (no serious violations)
- [ ] Keyboard navigation works on reader + admin console
- [ ] Contrast AA on primary text; focus rings visible; `prefers-reduced-motion` respected

## Backups & DR

- [ ] Supabase PITR/backups enabled; restore drill executed once
- [ ] Upstash data is disposable (verified queues rebuild on cold start)
- [ ] Render service URLS recorded (api + web) and DNS/custom domain decided

## Monitoring

- [ ] `/api/health` returns `database: up`, `auth.provider: supabase`
- [ ] UptimeRobot or Render built-in pings `/api/health` every 5 min (keeps the free instance awake + alerts)
- [ ] Error tracker (Sentry) wired with source maps
- [ ] Render instance-hours tracked against the 750 h/month cap

## Legal & Trust

- [ ] `/privacy`, `/terms`, cookie consent present or explicitly deferred
- [ ] Copyright/DMCA handling documented (manga aggregation exposure)

## Deployment verification

- [ ] Fresh deploy from `main`: API boots, `prisma db push` succeeds, seed job logs `🌱`
- [ ] Signup → login → read → library round-trip on the live URL
- [ ] Admin console reachable with an `admin` account
- [ ] Rollback plan: last known-good commit + Render redeploy

## Post-launch (first 48 h)

- [ ] Watch API logs for 5xx + slow queries
- [ ] Confirm queue jobs resolve; Redis command budget healthy
- [ ] Review signup funnel; spam/abuse signals
