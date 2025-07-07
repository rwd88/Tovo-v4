'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'

// — TON CONNECT PROVIDER — client-only, must be the very first thing
import { TonConnectUIProvider } from '@tonconnect/ui-react'

// — ETHEREUM CONTEXT (still client-side) —
import { EthereumProvider } from '../contexts/EthereumContext'

// — SOLANA ADAPTER (still client-side) —
import '@solana/wallet-adapter-react-ui/styles.css'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'

// Dynamic import for Solana providers to ensure client-side only
const SolanaProviders = dynamic(
  () => import('../components/SolanaProviders').then(mod => mod.default),
  { ssr: false }
)

// Load your TON manifest URL from env
const tonManifestUrl = process.env.NEXT_PUBLIC_TON_MANIFEST_URL!

export default function App({ Component, pageProps }: AppProps) {
  return (
    <TonConnectUIProvider manifestUrl={tonManifestUrl}>
      <EthereumProvider>
        <SolanaProviders>
          <Component {...pageProps} />
        </SolanaProviders>
      </EthereumProvider>
    </TonConnectUIProvider>
  )
}