// pages/_app.tsx
import '../styles/globals.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'

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

// Dynamically load NavBar only on client
const NavBar = dynamic(() => import('../src/components/NavBar'), {
  ssr: false
})

export default function App({ Component, pageProps }: AppProps) {
  // Solana config
  const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
  const solanaWallets  = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter()
  ]

  return (
    <TonConnectUIProvider>
      <EthereumProvider>
        <ConnectionProvider endpoint={solanaEndpoint}>
          <WalletProvider wallets={solanaWallets} autoConnect>
            {/* Only render NavBar on the client */}
            <NavBar />

            {/* Rest of your app */}
            <Component {...pageProps} />
          </WalletProvider>
        </ConnectionProvider>
      </EthereumProvider>
    </TonConnectUIProvider>
  )
}
