// components/Web3Providers.tsx
'use client'

import React, { ReactNode, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ─── Wagmi v2 / Ethereum ────────────────────────────────────────────────────────
import { WagmiConfig, createConfig, configureChains } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { publicProvider } from 'wagmi/providers/public'         // ← here
import { InjectedConnector } from '@wagmi/connectors/injected'  // ← same as before
// ────────────────────────────────────────────────────────────────────────────────

import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'

const queryClient = new QueryClient()

const { chains, publicClient, webSocketPublicClient } = configureChains(
  [mainnet],
  [publicProvider()],
)

const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [new InjectedConnector({ chains })],
  publicClient,
  webSocketPublicClient,
})

export default function Web3Providers({ children }: { children: ReactNode }) {
  useEffect(() => console.log('👍 Web3Providers mounted'), [])

  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <TonConnectUIProvider manifestUrl={process.env.NEXT_PUBLIC_TON_MANIFEST_URL!}>
          <ConnectionProvider endpoint={process.env.NEXT_PUBLIC_SOLANA_RPC_URL!}>
            <WalletProvider wallets={[new PhantomWalletAdapter()]} autoConnect>
              <WalletModalProvider>
                {children}
              </WalletModalProvider>
            </WalletProvider>
          </ConnectionProvider>
        </TonConnectUIProvider>
      </QueryClientProvider>
    </WagmiConfig>
  )
}
