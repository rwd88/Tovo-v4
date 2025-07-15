// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'

// ─── Wagmi v2 / Ethereum ───────────────────────────────────────────────────────
import {
  WagmiProvider,
  createConfig,
  http,
} from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Create a query client
const queryClient = new QueryClient()

// Configure wagmi config
const config = createConfig({
  chains: [mainnet],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
  },
})
// ────────────────────────────────────────────────────────────────────────────────

// ─── TON ────────────────────────────────────────────────────────────────────────
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { TonProvider } from '../contexts/TonContext'

// ─── Solana ─────────────────────────────────────────────────────────────────────
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

// ─── (Optional) Your own Ethereum context ───────────────────────────────────────
import { EthereumProvider } from '../contexts/EthereumContext'

export default function App({ Component, pageProps }: AppProps) {
  const tonManifestUrl = process.env.NEXT_PUBLIC_TON_MANIFEST_URL!
  const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
  const solanaWallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()]

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <TonConnectUIProvider manifestUrl={tonManifestUrl}>
          <EthereumProvider>
            <SolanaConnectionProvider endpoint={solanaEndpoint}>
              <SolanaWalletProvider wallets={solanaWallets} autoConnect>
                <SolanaProvider>
                  <TonProvider>
                    <Component {...pageProps} />
                  </TonProvider>
                </SolanaProvider>
              </SolanaWalletProvider>
            </SolanaConnectionProvider>
          </EthereumProvider>
        </TonConnectUIProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}