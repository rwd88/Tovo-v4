// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'

// ─── Wagmi v1 / Ethereum ───────────────────────────────────────────────────────
import { WagmiConfig, createClient, configureChains } from 'wagmi'
import { mainnet }      from 'wagmi/chains'
import { publicProvider }        from 'wagmi/providers/public'
import { InjectedConnector }     from 'wagmi/connectors/injected'

// configureChains gives you both an HTTP publicClient and a WS client
const { chains, provider, webSocketProvider } = configureChains(
  [mainnet],
  [publicProvider()],
)

const wagmiClient = createClient({
  autoConnect: true,
  connectors: [
    new InjectedConnector({ chains }),
  ],
  provider,
  webSocketProvider,
})
// ────────────────────────────────────────────────────────────────────────────────

// ─── TON Connect (browser-only) ────────────────────────────────────────────────
const TonConnectUIProvider = dynamic(
  () => import('@tonconnect/ui-react').then(m => m.TonConnectUIProvider),
  { ssr: false }
)
// ────────────────────────────────────────────────────────────────────────────────

// ─── Solana Wallets (browser-only) ─────────────────────────────────────────────
const SolanaProviders = dynamic(
  () => import('../components/SolanaProviders'),
  { ssr: false }
)
// ────────────────────────────────────────────────────────────────────────────────

export default function App({ Component, pageProps }: AppProps) {
  const tonManifest = process.env.NEXT_PUBLIC_TON_MANIFEST_URL!

  return (
    <WagmiConfig client={wagmiClient}>
      <TonConnectUIProvider manifestUrl={tonManifest}>
        <SolanaProviders>
          <Component {...pageProps} />
        </SolanaProviders>
      </TonConnectUIProvider>
    </WagmiConfig>
  )
}
