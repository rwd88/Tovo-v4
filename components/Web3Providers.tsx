// components/Web3Providers.tsx
'use client'

import React, { useMemo } from 'react'
import { WagmiConfig, createConfig, configureChains } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { publicProvider } from '@wagmi/core/providers/public'
import { InjectedConnector } from '@wagmi/connectors/injected'
import { http } from 'viem'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import {
  ConnectionProvider as SolanaConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets'

const queryClient = new QueryClient()

// 1️⃣ configureChains
const { publicClient, webSocketPublicClient } = configureChains(
  [mainnet],
  [publicProvider()],
)

// 2️⃣ createConfig
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [
    new InjectedConnector({ chains: [mainnet] }),
  ],
  publicClient,
  webSocketPublicClient,
})

export default function Web3Providers({ children }: { children: React.ReactNode }) {
  const tonManifestUrl = process.env.NEXT_PUBLIC_TON_MANIFEST_URL!
  const solanaEndpoint   = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!

  const solanaWallets = useMemo(
    () => [ new PhantomWalletAdapter(), new SolflareWalletAdapter() ],
    []
  )

  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <TonConnectUIProvider manifestUrl={tonManifestUrl}>
          <SolanaConnectionProvider endpoint={solanaEndpoint}>
            <SolanaWalletProvider wallets={solanaWallets} autoConnect>
              <WalletModalProvider>
                {children}
              </WalletModalProvider>
            </SolanaWalletProvider>
          </SolanaConnectionProvider>
        </TonConnectUIProvider>
      </QueryClientProvider>
    </WagmiConfig>
  )
}
