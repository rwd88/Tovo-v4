// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'

const Web3Providers = dynamic(
  () => import('../components/Web3Providers').then(mod => mod.default),
  { ssr: false }
)

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Web3Providers>
      <Component {...pageProps} />
    </Web3Providers>
  )
}
