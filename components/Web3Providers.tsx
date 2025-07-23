// components/Web3Providers.tsx
'use client'

import React from 'react'
import { WagmiConfig, createConfig, configureChains } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { publicProvider } from '@wagmi/core/providers/public'
import { InjectedConnector } from '@wagmi/connectors/injected'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import {
  ConnectionProvider,
  WalletProvider
} from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter
} from '@solana/wallet-adapter-wallets'

const queryClient = new QueryClient()

// configureChains will give us both publicClient & webSocketPublicClient
const { publicClient, webSocketPublicClient } = configureChains(
  [mainnet],
  [publicProvider()]
)

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [
    // this is the injected connector (e.g. MetaMask, Brave, etc)
    new InjectedConnector({ chains: [mainnet] })
  ],
  publicClient,
  webSocketPublicClient
})

const solanaWallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()]

export default function Web3Providers({ children }: { children: React.ReactNode }) {
  const tonManifestUrl = process.env.NEXT_PUBLIC_TON_MANIFEST_URL!

  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <TonConnectUIProvider manifestUrl={tonManifestUrl}>
          <ConnectionProvider endpoint={process.env.NEXT_PUBLIC_SOLANA_RPC_URL!}>
            <WalletProvider wallets={solanaWallets} autoConnect>
              <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
          </ConnectionProvider>
        </TonConnectUIProvider>
      </QueryClientProvider>
    </WagmiConfig>
  )
}
