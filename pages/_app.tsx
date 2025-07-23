// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'

// Dynamically load your Web3Providers wrapper (client-only)
const Web3Providers = dynamic(
  () => import('../components/Web3Providers').then((m) => m.default),
  { ssr: false }
)

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <Web3Providers>
      <Component {...pageProps} />
    </Web3Providers>
  )
}
