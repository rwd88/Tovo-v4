// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic' // <-- Add this import
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─── Wagmi Configuration ───────────────────────────────────────────────────────
import { WagmiProvider, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { http } from 'viem'

const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
})

// Dynamic imports
const TonConnectUIProvider = dynamic(
  () => import('@tonconnect/ui-react').then((mod) => mod.TonConnectUIProvider),
  { 
    ssr: false,
    loading: () => <div>Loading TON Connect...</div>
  }
)

const SolanaProviders = dynamic(
  () => import('../components/SolanaProviders').then((mod) => mod.default),
  { 
    ssr: false,
    loading: () => <div>Loading Wallets...</div>
  }
)

const queryClient = new QueryClient()

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <TonConnectUIProvider manifestUrl={process.env.NEXT_PUBLIC_TON_MANIFEST_URL!}>
          <SolanaProviders>
            <Component {...pageProps} />
          </SolanaProviders>
        </TonConnectUIProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}