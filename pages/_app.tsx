// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'

import { WagmiConfig, createConfig, configureChains } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { publicProvider } from '@wagmi/core/providers/public'
import { InjectedConnector } from '@wagmi/connectors/injected'

// ← this is the only correct import for HTTP transport
import { http } from 'viem'

const { publicClient, webSocketPublicClient } = configureChains(
  [mainnet],
  [publicProvider()],
)

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [
    new InjectedConnector({ chains: [mainnet] }),
  ],
  publicClient,
  webSocketPublicClient,
})

const TonConnectUIProvider = dynamic(
  () => import('@tonconnect/ui-react').then((m) => m.TonConnectUIProvider),
  { ssr: false },
)

const SolanaProviders = dynamic(
  () => import('../components/SolanaProviders').then((m) => m.default),
  { ssr: false },
)

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <TonConnectUIProvider manifestUrl={process.env.NEXT_PUBLIC_TON_MANIFEST_URL!}>
        <SolanaProviders>
          <Component {...pageProps} />
        </SolanaProviders>
      </TonConnectUIProvider>
    </WagmiConfig>
  )
}
