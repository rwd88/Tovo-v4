// components/Web3Providers.tsx
'use client'

import { WagmiProvider, createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'

const queryClient = new QueryClient()
const config = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http()
  }
})

const solanaWallets = [new PhantomWalletAdapter()]

export default function Web3Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <TonConnectUIProvider manifestUrl={process.env.NEXT_PUBLIC_TON_MANIFEST_URL!}>
          <ConnectionProvider endpoint={process.env.NEXT_PUBLIC_SOLANA_RPC_URL!}>
            <WalletProvider wallets={solanaWallets} autoConnect>
              <WalletModalProvider>
                {children}
              </WalletModalProvider>
            </WalletProvider>
          </ConnectionProvider>
        </TonConnectUIProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}