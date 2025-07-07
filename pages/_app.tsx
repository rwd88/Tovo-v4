// pages/_app.tsx
import '../styles/globals.css'
import type { AppProps } from 'next/app'

// Global Providers
import { EthereumProvider } from '../contexts/EthereumContext'
import NavBar from '../src/components/NavBar'

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
      {/* Wrap NavBar within wallet providers so all connectors have context */}
      <ConnectionProvider endpoint={solanaEndpoint}>
        <WalletProvider wallets={solanaWallets} autoConnect>
          <NavBar />
          <Component {...pageProps} />
        </WalletProvider>
      </ConnectionProvider>
    </EthereumProvider>
  )
}
