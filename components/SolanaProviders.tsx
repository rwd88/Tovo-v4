'use client'

import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'

const solanaNetwork = WalletAdapterNetwork.Mainnet
const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
const solanaWallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
]

export default function SolanaProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConnectionProvider endpoint={solanaEndpoint}>
      <WalletProvider wallets={solanaWallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}