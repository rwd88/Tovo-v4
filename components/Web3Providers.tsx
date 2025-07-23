// components/Web3Providers.tsx
'use client'

import React, { ReactNode } from 'react'

export default function Web3Providers({ children }: { children: ReactNode }) {
  try {
    // -- below is your real Web3Providers code: WagmiConfig, QueryClientProvider, etc. --
    return (
      <div style={{ padding: 20, color: 'green' }}>
        👍 Web3Providers mounted successfully!
        {children}
      </div>
    )
  } catch (err) {
    console.error('💥 Error in Web3Providers:', err)
    return (
      <div style={{ padding: 20, color: 'red' }}>
        ❌ Web3Providers crash: check console
      </div>
    )
  }
}
