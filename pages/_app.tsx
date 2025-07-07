// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'

// — TON CONNECT PROVIDER — client-only, must be the very first thing
import { TonConnectUIProvider } from '@tonconnect/ui-react'

// — ETHEREUM CONTEXT (still client-side) —
import { EthereumProvider } from '../contexts/EthereumContext'

// — SOLANA ADAPTER (still client-side) —
import '@solana/wallet-adapter-react-ui/styles.css'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets'

const solanaNetwork = WalletAdapterNetwork.Mainnet
const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
const solanaWallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
]

// Load your TON manifest URL from env
const tonManifestUrl = process.env.NEXT_PUBLIC_TON_MANIFEST_URL!

export default function App({ Component, pageProps }: AppProps) {
  return (
    <TonConnectUIProvider manifestUrl={tonManifestUrl}>
      <EthereumProvider>
        <ConnectionProvider endpoint={solanaEndpoint}>
          <WalletProvider wallets={solanaWallets} autoConnect>
            <Component {...pageProps} />
          </WalletProvider>
        </ConnectionProvider>
      </EthereumProvider>
    </TonConnectUIProvider>
  )
}
