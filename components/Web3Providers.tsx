// components/Web3Providers.tsx
'use client'

import React, { ReactNode, useMemo } from 'react'
import { WagmiConfig, createConfig, configureChains } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { publicProvider } from 'wagmi/providers/public'
import { InjectedConnector } from 'wagmi/connectors/injected'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// TON
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { TonProvider } from '../contexts/TonContext'

// SOLANA
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets'

// YOUR ETHEREUM (optional) context
import { EthereumProvider } from '../contexts/EthereumContext'

interface Props {
  children: ReactNode
}
export default function Web3Providers({ children }: Props) {
  // ─── wagmi configuration ───────────────────────────────────
  const { publicClient, webSocketPublicClient } = configureChains(
    [mainnet],
    [publicProvider()],
  )
  const wagmiConfig = createConfig({
    autoConnect: true,
    publicClient,
    webSocketPublicClient,
    connectors: [
      new InjectedConnector({ chains: [mainnet] }),
    ],
  })

  // ─── react-query ────────────────────────────────────────────
  const queryClient = useMemo(() => new QueryClient(), [])

  // ─── solana ────────────────────────────────────────────────
  const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
  const solanaWallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  )

  // ─── ton ────────────────────────────────────────────────────
  const tonManifestUrl = process.env.NEXT_PUBLIC_TON_MANIFEST_URL!

  return (
    <WagmiConfig config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <TonConnectUIProvider manifestUrl={tonManifestUrl}>
          <EthereumProvider>
            <ConnectionProvider endpoint={solanaEndpoint}>
              <WalletProvider wallets={solanaWallets} autoConnect>
                <WalletModalProvider>
                  <TonProvider>
                    {children}
                  </TonProvider>
                </WalletModalProvider>
              </WalletProvider>
            </ConnectionProvider>
          </EthereumProvider>
        </TonConnectUIProvider>
      </QueryClientProvider>
    </WagmiConfig>
  )
}
