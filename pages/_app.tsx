'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect, useState } from 'react'
import ErrorBoundary from '../components/ErrorBoundary'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Wagmi Config
import { WagmiProvider, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { http } from 'viem'

const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
})

// Dynamic imports for client-side only components
const TonConnectUIProvider = dynamic(
  () => import('@tonconnect/ui-react').then((mod) => mod.TonConnectUIProvider),
  { ssr: false }
)

const SolanaProviders = dynamic(
  () => import('../components/SolanaProviders').then((mod) => mod.default),
  { ssr: false }
)

const queryClient = new QueryClient()

export default function App({ Component, pageProps }: AppProps) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return <div>Loading...</div>

  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <TonConnectUIProvider manifestUrl={process.env.NEXT_PUBLIC_TON_MANIFEST_URL!}>
            <SolanaProviders>
              <Component {...pageProps} />
            </SolanaProviders>
          </TonConnectUIProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  )
}