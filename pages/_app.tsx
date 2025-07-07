// pages/_app.tsx
import '../styles/globals.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'

// Global Ethereum context provider
import { EthereumProvider } from '../contexts/EthereumContext'

// TON Connect UI wrapper for TON in-page
import { TonConnectUIProvider } from '@tonconnect/ui-react'

// Dynamically import NavBar to prevent SSR issues
const NavBar = dynamic(() => import('../src/components/NavBar'), { ssr: false })

// Solana Wallet Adapter styles & providers
import '@solana/wallet-adapter-react-ui/styles.css'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import {
  ConnectionProvider,
  WalletProvider
} from '@solana/wallet-adapter-react'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter
} from '@solana/wallet-adapter-wallets'

// Solana RPC endpoint and wallets setup
const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
const solanaWallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
]

// pages/_app.tsx
import '../styles/globals.css'
import '@tonconnect/ui-react/styles.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'

// Global Ethereum context provider
import { EthereumProvider } from '../contexts/EthereumContext'

// TON Connect UI wrapper for TON in-page
import { TonConnectUIProvider } from '@tonconnect/ui-react'

// Solana Wallet Adapter styles & providers
import '@solana/wallet-adapter-react-ui/styles.css'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import {
  ConnectionProvider,
  WalletProvider
} from '@solana/wallet-adapter-react'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter
} from '@solana/wallet-adapter-wallets'

// Dynamically import NavBar to prevent SSR issues
const NavBar = dynamic(() => import('../src/components/NavBar'), { ssr: false })

const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
const solanaWallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
]

export default function App({ Component, pageProps }: AppProps) {
  return (
    <EthereumProvider>
      {/* TON Connect wrapper must be at top of app */}
      <TonConnectUIProvider>
        {/* Solana providers */}
        <ConnectionProvider endpoint={solanaEndpoint}>
          <WalletProvider wallets={solanaWallets} autoConnect>
            {/* Navigation */}
            <NavBar />
            {/* Page content */}
            <Component {...pageProps} />
          </WalletProvider>
        </ConnectionProvider>
      </TonConnectUIProvider>
    </EthereumProvider>
  )({ Component, pageProps }: AppProps) {
  return (
    <EthereumProvider>
      {/* Wrap with TON Connect provider */}
      <TonConnectUIProvider>
        {/* Solana connection and wallet providers */}
        <ConnectionProvider endpoint={solanaEndpoint}>
          <WalletProvider wallets={solanaWallets} autoConnect>
            {/* Main navigation bar */}
            <NavBar />
            {/* Page content */}
            <Component {...pageProps} />
          </WalletProvider>
        </ConnectionProvider>
      </TonConnectUIProvider>
    </EthereumProvider>
  )
}