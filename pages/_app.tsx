// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Client-only wrapper for all Web3 providers
const Web3Providers = dynamic(
  () => import('../components/Web3Providers').then((m) => m.default),
  { ssr: false }
)

const queryClient = new QueryClient()

export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <Web3Providers>
        <Component {...pageProps} />
      </Web3Providers>
    </QueryClientProvider>
  )
}
