// components/Web3Providers.tsx
'use client'

import React from 'react'
import { EthereumProvider } from '../contexts/EthereumContext'
import { SolanaProvider } from '../contexts/SolanaContext'
import { TonProvider } from '../contexts/TonContext'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { TonConnectUIProvider } from '@tonconnect/ui-react'

require('@solana/wallet-adapter-react-ui/styles.css')

export const Web3Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <TonConnectUIProvider manifestUrl="https://your-app.com/tonconnect-manifest.json">
      <EthereumProvider>
        <SolanaProvider>
          <WalletModalProvider>
            {children}
          </WalletModalProvider>
        </SolanaProvider>
      </EthereumProvider>
    </TonConnectUIProvider>
  )
}