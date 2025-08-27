/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // helps debug minified errors in production
  productionBrowserSourceMaps: true,

  // keep your build skips
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig; // ✅ ESM export
