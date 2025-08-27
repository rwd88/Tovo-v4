/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // ✅ lets Chrome DevTools map minified stack traces to your real files/lines in prod
  productionBrowserSourceMaps: true,

  // (yours) skip lint & TS build errors in prod builds
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
}

// Use CommonJS export for .js files (avoids config import issues)
module.exports = nextConfig
