// pages/_app.tsx
import '../styles/globals.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'

// Global Ethereum context provider
import { EthereumProvider } from '../contexts/EthereumContext'

// Dynamically import NavBar on client side to avoid SSR "window" errors
const NavBar = dynamic(() => import('../src/components/NavBar'), { ssr: false })

// Solana Wallet Adapter styles & providers
import '@solana/wallet-adapter-react-ui/styles.css'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets'

// Environment variables
const solanaNetwork = WalletAdapterNetwork.Mainnet
const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
const solanaWallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
]

export default function App({ Component, pageProps }: AppProps) {
  return (
    <EthereumProvider>
      {/* Wrap NavBar within wallet providers */}
      <ConnectionProvider endpoint={solanaEndpoint}>
        <WalletProvider wallets={solanaWallets} autoConnect>
          <NavBar />
          <Component {...pageProps} />
        </WalletProvider>
      </ConnectionProvider>
    </EthereumProvider>
  )
}
