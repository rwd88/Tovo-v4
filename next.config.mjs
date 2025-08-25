// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip ESLint errors during production builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Skip TypeScript type‐check errors during production builds
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
