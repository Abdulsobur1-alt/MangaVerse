import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@mangaverse/shared'],
  // Standalone output traces only the files the server needs, producing a
  // self-contained `server.js` that the Docker image can run directly.
  output: 'standalone',
  // Pin the tracing root to the monorepo root so the standalone output
  // nests the app under apps/web/ deterministically (the Dockerfile's
  // `node apps/web/server.js` relies on this layout).
  outputFileTracingRoot: path.join(__dirname, '../../'),
  experimental: {
    optimizePackageImports: ['@mangaverse/shared'],
  },
  // Proxy browser-facing /api/* paths (e.g. /api/download/...apk on the
  // download page) to the API service. The app's data calls use absolute
  // NEXT_PUBLIC_API_URL URLs from lib/api.ts and never hit these; this
  // rewrite only serves relative /api/* links on the web origin. Same
  // fallback default as lib/api.ts.
  async rewrites() {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
