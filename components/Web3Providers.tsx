'use client'

import React, { ReactNode, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// your three contexts
import { EthereumProvider } from '../contexts/EthereumContext'
import { SolanaProvider }   from '../contexts/SolanaContext'
import { TonProvider }      from '../contexts/TonContext'

// Solana UI wrapper (inside your SolanaProvider you already use WalletAdapter & Modal)
import '@solana/wallet-adapter-react-ui/styles.css'

export default function Web3Providers({ children }: { children: ReactNode }) {
  useEffect(() => console.log('🔌 Web3Providers mounted'), [])

  return (
    <EthereumProvider>
      <SolanaProvider>
        <TonProvider>
          <QueryClientProvider client={new QueryClient()}>
            {children}
          </QueryClientProvider>
        </TonProvider>
      </SolanaProvider>
    </EthereumProvider>
  )
}
