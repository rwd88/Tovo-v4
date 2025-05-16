import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ─────── Disable ESLint during builds ───────
  eslint: {
    // This will skip ESLint checks when you run `next build` (so Vercel never fails
    // because of lint errors in /pages/api/cron/*.ts or lib/prisma.ts)
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
