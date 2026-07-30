# 📚 MangaVerse

**Dual-Platform Manga / Manhwa / Manhua / Light Novel Reading Ecosystem**

A cross-platform reading platform built with React Native (Expo) for mobile and Next.js for the web, sharing a unified backend and TypeScript types.

## Monorepo Structure

```
mangaverse/
├── apps/
│   ├── web/          # Next.js 15 web application
│   └── mobile/       # React Native (Expo) mobile app
├── packages/
│   └── shared/       # Shared TypeScript types, utilities, and API contracts
├── turbo.json        # Turborepo pipeline configuration
└── pnpm-workspace.yaml
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Start all development servers
pnpm dev

# Run specific app
pnpm --filter @mangaverse/web dev
pnpm --filter @mangaverse/mobile dev

# Build all apps
pnpm build

# Lint all apps
pnpm lint
```

## Tech Stack

| Layer          | Technology                              |
|----------------|----------------------------------------|
| Mobile App     | React Native (Expo SDK 52)             |
| Web App        | Next.js 15 (App Router)                |
| Shared         | TypeScript, Zod                        |
| Package Mgr    | pnpm + Turborepo                       |
| Styling (Web)  | Tailwind CSS v4                        |
| State Mgmt     | Zustand + TanStack Query               |
