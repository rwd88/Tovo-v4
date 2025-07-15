// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─── Wagmi v2 / Ethereum ───────────────────────────────────────────────────────
import { WagmiProvider, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { http } from 'viem'

const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
})

// ─── TON ────────────────────────────────────────────────────────────────────────
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { TonProvider } from '../contexts/TonContext'

// ─── Solana ─────────────────────────────────────────────────────────────────────
import dynamic from 'next/dynamic'
const SolanaProviders = dynamic(
  () => import('../components/SolanaProviders').then((mod) => mod.default),
  { ssr: false }
)
import { SolanaProvider } from '../contexts/SolanaContext'

// Create a query client
const queryClient = new QueryClient()

export default function App({ Component, pageProps }: AppProps) {
  const tonManifestUrl = process.env.NEXT_PUBLIC_TON_MANIFEST_URL!

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <TonConnectUIProvider manifestUrl={tonManifestUrl}>
          <SolanaProviders>
            <SolanaProvider>
              <TonProvider>
                <Component {...pageProps} />
              </TonProvider>
            </SolanaProvider>
          </SolanaProviders>
        </TonConnectUIProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}