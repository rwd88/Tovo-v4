/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  productionBrowserSourceMaps: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },

  async headers() {
    const csp = [
      "default-src 'self'",
      // allow your Vercel asset hosts; add others you actually use
      "img-src 'self' data: https: blob:",
      "font-src 'self' https:",
      "style-src 'self' 'unsafe-inline' https:",
      "script-src 'self' 'unsafe-inline' https:",
      "connect-src 'self' https: wss:",
      // if you embed walletconnect bridges or RPCs, list them explicitly
      // e.g.: "https://rpc.ankr.com https://mainnet.infura.io ..."
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
          // 6 months HSTS; include subdomains once you’re sure
          { key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains; preload' },
          // lock down powerful APIs (adjust if you actually need any)
          {
            key: 'Permissions-Policy',
            value: [
              'accelerometer=()',
              'camera=()',
              'geolocation=()',
              'gyroscope=()',
              'magnetometer=()',
              'microphone=()',
              'payment=(self)',
              'usb=()',
              'clipboard-read=(self)',
              'clipboard-write=(self)'
            ].join(', ')
          }
        ]
      }
    ]
  }
}

export default nextConfig
