// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
