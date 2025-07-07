// pages/_app.tsx
import '../styles/globals.css'
import type { AppProps } from 'next/app'

// EVM context
import { EthereumProvider } from '../contexts/EthereumContext'

// Solana Wallet Adapter
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

// TON Connect UI
import { TonConnectUIProvider } from '@tonconnect/ui-react'

// Your NavBar
import NavBar from '../src/components/NavBar'

export default function App({ Component, pageProps }: AppProps) {
  // Solana setup
  const solanaNetwork  = WalletAdapterNetwork.Mainnet
  const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
  const solanaWallets  = [ new PhantomWalletAdapter(), new SolflareWalletAdapter() ]

  return (
    <TonConnectUIProvider>
      <EthereumProvider>
        <ConnectionProvider endpoint={solanaEndpoint}>
          <WalletProvider wallets={solanaWallets} autoConnect>

            {/* NavBar now inside all providers */}
            <NavBar />

            <Component {...pageProps} />
          </WalletProvider>
        </ConnectionProvider>
      </EthereumProvider>
    </TonConnectUIProvider>
  )
}
