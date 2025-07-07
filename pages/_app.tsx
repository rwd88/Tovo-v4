// pages/_app.tsx
import '../styles/globals.css'
import '@tonconnect/ui-react/styles.css'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'

// Ethereum context
import { EthereumProvider } from '../contexts/EthereumContext'

// TON Connect UI wrapper
import { TonConnectUIProvider } from '@tonconnect/ui-react'

// Solana Wallet Adapter styles & providers
import '@solana/wallet-adapter-react-ui/styles.css'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'

// Dynamically import NavBar to prevent SSR issues
const NavBar = dynamic(() => import('../src/components/NavBar'), { ssr: false })

// Solana config
const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
const solanaWallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
]

export default function App({ Component, pageProps }: AppProps) {
  return (
    <EthereumProvider>
      <TonConnectUIProvider>
        <ConnectionProvider endpoint={solanaEndpoint}>
          <WalletProvider wallets={solanaWallets} autoConnect>
            <NavBar />
            <Component {...pageProps} />
          </WalletProvider>
        </ConnectionProvider>
      </TonConnectUIProvider>
    </EthereumProvider>
  )
}
