// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'

// ─── Wagmi v2 / Ethereum ───────────────────────────────────────────────────────
// Pull core functions from the “config” entrypoint:
import {
  configureChains,
  createConfig,
  WagmiConfig,
} from 'wagmi/config'

// Pull connectors, providers, and chains from their own entrypoints:
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
const { publicClient, webSocketPublicClient } = configureChains(
  [mainnet],
  [publicProvider()]
)

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [ new InjectedConnector({ chains: [mainnet] }) ],
  publicClient,
  webSocketPublicClient,
})
// ────────────────────────────────────────────────────────────────────────────────

const tonManifestUrl = process.env.NEXT_PUBLIC_TON_MANIFEST_URL!
const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
const solanaWallets  = [
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
