// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'

// TON
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { TonProvider }          from '../contexts/TonContext'

// Your Viem/Ethereum context
import { EthereumProvider } from '../contexts/EthereumContext'

// Solana
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

import type { WalletAdapterError, WalletAdapter } from '@solana/wallet-adapter-base'

// ─── Proper Solana‐adapter error handler ────────────────────────────────────────
function handleWalletError(
  error: WalletAdapterError,
  adapter?: WalletAdapter
) {
  console.warn(
    `[SolanaAdapterError]`,
    adapter?.name ?? 'unknown adapter',
    error.message
  )
}

// ─── App ───────────────────────────────────────────────────────────────────────
export default function App({ Component, pageProps }: AppProps) {
  const tonManifestUrl = process.env.NEXT_PUBLIC_TON_MANIFEST_URL!
  const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!

  const solanaWallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ]

  return (
    <TonConnectUIProvider manifestUrl={tonManifestUrl}>
      <EthereumProvider>
        <SolanaConnectionProvider endpoint={solanaEndpoint}>
          <SolanaWalletProvider
            wallets={solanaWallets}
            autoConnect
            onError={handleWalletError}    // ← use correct signature
          >
            <SolanaProvider>
              <Component {...pageProps} />
            </SolanaProvider>
          </SolanaWalletProvider>
        </SolanaConnectionProvider>
      </EthereumProvider>
    </TonConnectUIProvider>
  )
}
