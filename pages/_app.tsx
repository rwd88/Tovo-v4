// pages/_app.tsx
import '../styles/globals.css'
import type { AppProps } from 'next/app'

// EVM context (your existing)
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
import { TonConnectProvider } from '@tonconnect/ui-react'

// Your NavBar with all three connect buttons
import NavBar from '../src/components/NavBar'

export default function App({ Component, pageProps }: AppProps) {
  // Solana setup (you already had this)
  const solanaNetwork  = WalletAdapterNetwork.Mainnet
  const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
  const solanaWallets  = [ new PhantomWalletAdapter(), new SolflareWalletAdapter() ]

  return (
    <TonConnectProvider>
      <EthereumProvider>
        <ConnectionProvider endpoint={solanaEndpoint}>
          <WalletProvider wallets={solanaWallets} autoConnect>
            {/* Now all providers are live before NavBar */}
            <NavBar />

            {/* And then your page content */}
            <Component {...pageProps} />
          </WalletProvider>
        </ConnectionProvider>
      </EthereumProvider>
    </TonConnectProvider>
  )
}
