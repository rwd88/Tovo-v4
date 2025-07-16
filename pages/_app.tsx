// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic' // <-- THIS MUST BE PRESENT
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Client-side only dynamic imports
const Web3Providers = dynamic(
  () => import('../components/Web3Providers').then((mod) => mod.default),
  { 
    ssr: false,
    loading: () => <div>Loading web3 providers...</div>
  }
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