// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'

// 1️⃣ Wagmi / Ethereum (v1 API)
import {
  WagmiConfig,
  createConfig,
  configureChains,
} from 'wagmi'
import { InjectedConnector } from 'wagmi/connectors/injected'
import { publicProvider }      from 'wagmi/providers/public'
import { mainnet }             from 'wagmi/chains'

// 2️⃣ TON
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { TonProvider } from '../contexts/TonContext'

// 3️⃣ Solana
import { SolanaProvider } from '../contexts/SolanaContext'
import {
  ConnectionProvider as SolanaConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from '@solana/wallet-adapter-react'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import '@solana/wallet-adapter-react-ui/styles.css'

// 4️⃣ Your own Ethereum context (if you have one)
import { EthereumProvider } from '../contexts/EthereumContext'

// ────────────────────────────────────────────────────────────────────────────────
// Wagmi v2 setup
const { publicClient, webSocketPublicClient } = configureChains(
  [mainnet],
  [publicProvider()]
)

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [
    new InjectedConnector({ chains: [mainnet] })
  ],
  publicClient,
  webSocketPublicClient,
})
// ────────────────────────────────────────────────────────────────────────────────

// TON and Solana endpoints
const tonManifestUrl = process.env.NEXT_PUBLIC_TON_MANIFEST_URL!
const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
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
                {/* Now your Next.js page */}
                <Component {...pageProps} />
              </SolanaProvider>
            </SolanaWalletProvider>
          </SolanaConnectionProvider>
        </EthereumProvider>
      </TonConnectUIProvider>
    </WagmiConfig>
  )
}
