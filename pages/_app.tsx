// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'
import { WagmiConfig, createConfig, configureChains } from 'wagmi'
import { mainnet } from 'wagmi/chains'

// ↙️ these two moved into separate packages:
import { publicProvider } from '@wagmi/core/providers/public'
import { InjectedConnector } from '@wagmi/connectors/injected'

// 1) configureChains gives you both an HTTP “publicClient” and a WS “webSocketPublicClient”
const { publicClient, webSocketPublicClient } = configureChains(
  [mainnet],
  [
    publicProvider(),
  ]
)

// 2) createConfig replaces the old createClient in Wagmi v2
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [ new InjectedConnector({ chains: [mainnet] }) ],
  publicClient,
  webSocketPublicClient,
})

// TON (browser-only)
const TonConnectUIProvider = dynamic(
  () => import('@tonconnect/ui-react').then(mod => mod.TonConnectUIProvider),
  { ssr: false }
)

// Solana (browser-only)
const SolanaProviders = dynamic(
  () => import('../components/SolanaProviders').then(mod => mod.default),
  { ssr: false }
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
