// src/pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'

// dynamically load Web3Providers on the client only
const Web3Providers = dynamic(
  () => import('../components/Web3Providers'),
  {
    ssr: false,
    loading: () => <div>Loading Web3…</div>,
  }
)

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <Web3Providers>
      <Component {...pageProps} />
    </Web3Providers>
  )
}
