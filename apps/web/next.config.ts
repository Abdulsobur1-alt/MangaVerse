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
};

export default nextConfig;
