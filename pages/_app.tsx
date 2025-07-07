// pages/_app.tsx
import '../styles/globals.css'
import type { AppProps } from 'next/app'

// — TonConnect UI Provider —
import { TonConnectUIProvider } from '@tonconnect/ui-react'

// — Ethereum context provider —
import { EthereumProvider } from '../contexts/EthereumContext'

// — Solana Wallet Adapter styles & providers —
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

const solanaNetwork = WalletAdapterNetwork.Mainnet
const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
const solanaWallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
]

// Your TonConnect manifest URL (make sure to set NEXT_PUBLIC_TON_MANIFEST_URL in Vercel)
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
