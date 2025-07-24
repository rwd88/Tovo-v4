// components/Web3Providers.tsx
'use client'

import { EthereumProvider } from '../contexts/EthereumContext'
import { SolanaProvider } from '../contexts/SolanaContext'
import { TonProvider } from '../contexts/TonContext'

export const Web3Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <EthereumProvider>
      <SolanaProvider>
        <TonProvider>
          {children}
        </TonProvider>
      </SolanaProvider>
    </EthereumProvider>
  )
}