// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'

// TON
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { TonProvider }          from '../contexts/TonContext'

// Your own Ethereum context
import { EthereumProvider } from '../contexts/EthereumContext'

// Solana
import { SolanaProvider } from '../contexts/SolanaContext'
import {
  ConnectionProvider as SolanaConnectionProvider,
  WalletProvider     as SolanaWalletProvider,
  WalletContextState,
  WalletAdapterNetwork,
} from '@solana/wallet-adapter-react'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import '@solana/wallet-adapter-react-ui/styles.css'

// ─── SOLANA ERROR HANDLER ──────────────────────────────────────────────────────
// This will catch any adapter errors (like the stream middleware race) and log them,
// instead of letting React unmount your app with Error #310.
function handleSolanaError(
  error: Error,
  walletContext: WalletContextState
) {
  console.warn(
    `[SolanaAdapterError]`,
    walletContext.wallet?.adapter.name || 'unknown',
    error.message
  )
}

// ─── APP ────────────────────────────────────────────────────────────────────────
export default function App({ Component, pageProps }: AppProps) {
  const tonManifestUrl = process.env.NEXT_PUBLIC_TON_MANIFEST_URL!
  const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!

  // instantiate these only once
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
            onError={handleSolanaError}      // ← catch & swallow adapter errors
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
