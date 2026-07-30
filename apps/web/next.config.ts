import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@mangaverse/shared'],
  experimental: {
    optimizePackageImports: ['@mangaverse/shared'],
  },
};

export default nextConfig;
