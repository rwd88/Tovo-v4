// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'
import { ErrorBoundary } from '../components/ErrorBoundary'

const Web3Providers = dynamic(
  () => import('../components/Web3Providers').then((mod) => mod.Web3Providers),
  { 
    ssr: false,
    loading: () => <div className="loading">Loading Web3...</div>
  }
)

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <Web3Providers>
        <Component {...pageProps} />
      </Web3Providers>
    </ErrorBoundary>
  )
}