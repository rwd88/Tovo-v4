// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'

// dynamically load our entire Web3 stack (client-only)
const Web3Providers = dynamic(
  () => import('../components/Web3Providers').then((m) => m.default),
  { ssr: false, loading: () => <div>Loading…</div> }
)

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <Web3Providers>
      <Component {...pageProps} />
    </Web3Providers>
  )
}
