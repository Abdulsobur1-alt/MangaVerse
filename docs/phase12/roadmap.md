# Product & Platform Roadmap — MangaVerse

Guiding principle: quality before features; every quarter ships platform
hardening alongside one user-facing bet.

## 0–3 months — Stability & Trust

- Complete the P1 hardening wave (structured logging, OpenAPI, request-id,
  integration + E2E tests, Sentry).
- Switch DB migrations from boot-time `prisma db push` to `migrate deploy`
  (re-baseline first); automated backup runbook.
- Legal pages (privacy/terms/DMCA), cookie consent.
- Custom domain on Render (paid) or move web to a static host.

## 3–6 months — Monetization foundations

- Premium membership (ad-free, early chapters) with a real payment provider
  (Stripe) + the existing coin system.
- Analytics: privacy-first product analytics + reader/feature-usage events.
- PWA polish: install prompt, splash, offline library (beyond reading).

## 6–12 months — Growth engines

- Recommendation engine (collaborative filtering on reading history; Redis).
- Creator program: verified translators/uploaders with attribution + payout.
- Publisher integrations (MangaDex-first today; direct publishers next).
- i18n: next-intl, top-5 locales, RTL, timezone-aware release schedules.

## 12–18 months — Platform scale

- Native apps (Expo → stores) with the same API; offline sync engine.
- Move off Render free tier: managed Postgres at scale, edge caching (CDN),
  zero-downtime deploys (blue/green or rolling).
- Enterprise features: SSO (SAML/OIDC), audit export, custom domains per
  publisher.
- AI features: smart summaries, search embeddings, personalized digests
  (reuse the existing BullMQ/Redis substrate).

## Standing bets (every quarter)

- Security review pass (OWASP Top 10 + dependency audit).
- Performance budget regression check (Lighthouse in CI).
- Docs/runbooks updated with every incident.
