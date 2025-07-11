// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip TS type‐check errors
  typescript: {
    ignoreBuildErrors: true,
  },
  // Skip ESLint errors during build
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
