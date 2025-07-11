// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'

// ─── Wagmi v2 / Ethereum ───────────────────────────────────────────────────────
// Core config functions and component come from @wagmi/core
import {
  configureChains,
  createConfig,
  WagmiConfig,
} from '@wagmi/core'

// Connectors, providers and chains come from the wagmi package
import { InjectedConnector } from 'wagmi/connectors/injected'
import { publicProvider }    from 'wagmi/providers/public'
import { mainnet }           from 'wagmi/chains'

// ─── TON ────────────────────────────────────────────────────────────────────────
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { TonProvider }          from '../contexts/TonContext'

// ─── Solana ─────────────────────────────────────────────────────────────────────
import { SolanaProvider } from '../contexts/SolanaContext'
import {
  ConnectionProvider as SolanaConnectionProvider,
  WalletProvider     as SolanaWalletProvider,
} from '@solana/wallet-adapter-react'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import '@solana/wallet-adapter-react-ui/styles.css'

// ─── (Optional) Your own Ethereum context ───────────────────────────────────────
import { EthereumProvider } from '../contexts/EthereumContext'

// ────────────────────────────────────────────────────────────────────────────────
// 1) Configure which chains and providers you want to use.
//    configureChains returns both an HTTP “publicClient” and a WS client.
const { publicClient, webSocketPublicClient } = configureChains(
  [mainnet],
  [publicProvider()]
)

// 2) Build your wagmi configuration object
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [
    new InjectedConnector({ chains: [mainnet] }),
  ],
  publicClient,
  webSocketPublicClient,
})
// ────────────────────────────────────────────────────────────────────────────────

// Environment‐based endpoints
const tonManifestUrl = process.env.NEXT_PUBLIC_TON_MANIFEST_URL!
const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!

// The wallet adapters you want available
const solanaWallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
]

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WagmiConfig config={wagmiConfig}>
      <TonConnectUIProvider manifestUrl={tonManifestUrl}>
        <EthereumProvider>
          <SolanaConnectionProvider endpoint={solanaEndpoint}>
            <SolanaWalletProvider wallets={solanaWallets} autoConnect>
              <SolanaProvider>
                <Component {...pageProps} />
              </SolanaProvider>
            </SolanaWalletProvider>
          </SolanaConnectionProvider>
        </EthereumProvider>
      </TonConnectUIProvider>
    </WagmiConfig>
  )
}
