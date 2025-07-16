// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─── wagmi v2 setup ────────────────────────────────────────────────────────────
import { WagmiConfig, createConfig, configureChains } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { publicProvider } from '@wagmi/core/providers/public'
import { InjectedConnector } from '@wagmi/connectors/injected'

// ─── rainbow-kit setup ─────────────────────────────────────────────────────────
import {
  RainbowKitProvider,
  getDefaultWallets,
  midnightTheme,
} from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'

// ─── Dynamic client-only providers ────────────────────────────────────────────
const TonConnectUIProvider = dynamic(
  () => import('@tonconnect/ui-react').then((m) => m.TonConnectUIProvider),
  { ssr: false, loading: () => <div>Loading TON…</div> }
)
const SolanaProviders = dynamic(
  () => import('../components/SolanaProviders').then((m) => m.default),
  { ssr: false, loading: () => <div>Loading Solana…</div> }
)

// ─── react-query client ────────────────────────────────────────────────────────
const queryClient = new QueryClient()

// ─── chains & clients for wagmi ────────────────────────────────────────────────
const { publicClient, webSocketPublicClient } = configureChains(
  [mainnet],
  [publicProvider()]
)

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [
    new InjectedConnector({ chains: [mainnet] }),
    // …add any other connectors here…
  ],
  publicClient,
  webSocketPublicClient,
})

// ─── RainbowKit defaults ───────────────────────────────────────────────────────
const { chains, connectors } = getDefaultWallets({
  appName: 'Tovo Prediction Market',
  chains: [mainnet],
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider
        chains={chains}
        connectors={connectors}
        theme={midnightTheme()}
      >
        <QueryClientProvider client={queryClient}>
          <TonConnectUIProvider
            manifestUrl={process.env.NEXT_PUBLIC_TON_MANIFEST_URL!}
          >
            <SolanaProviders>
              <Component {...pageProps} />
            </SolanaProviders>
          </TonConnectUIProvider>
        </QueryClientProvider>
      </RainbowKitProvider>
    </WagmiConfig>
  )
}
