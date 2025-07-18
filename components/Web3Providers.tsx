// components/Web3Providers.tsx
'use client'

import React, { ReactNode } from 'react'
import dynamic from 'next/dynamic'

// TON
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { TonProvider } from '../contexts/TonContext'

// EVM (MetaMask)
import { EthereumProvider } from '../contexts/EthereumContext'

// Solana (client-only)
const SolanaProviders = dynamic(
  () => import('./SolanaProviders').then((mod) => mod.default),
  { ssr: false }
)

interface Web3ProvidersProps {
  children: ReactNode
}

export default function Web3Providers({ children }: Web3ProvidersProps) {
  // your TON manifest URL
  const tonManifestUrl = process.env.NEXT_PUBLIC_TON_MANIFEST_URL!

  return (
    <TonConnectUIProvider manifestUrl={tonManifestUrl}>
      <TonProvider>
        <EthereumProvider>
          <SolanaProviders>
            {children}
          </SolanaProviders>
        </EthereumProvider>
      </TonProvider>
    </TonConnectUIProvider>
  )
}
