// pages/_app.tsx
import '../styles/globals.css'
import type { AppProps } from 'next/app'

// 1) Ethereum Context
import { EthereumProvider } from '../contexts/EthereumContext'

// 2) Solana Wallet Adapter
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

// 3) TonConnect UI Provider
import { TonConnectUIProvider } from '@tonconnect/ui-react'

export default function MyApp({ Component, pageProps }: AppProps) {
  // Solana setup
  const solanaNetwork = WalletAdapterNetwork.Mainnet
  const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
  const solanaWallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ]

  return (
    <TonConnectUIProvider>
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
