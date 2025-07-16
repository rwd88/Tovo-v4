// components/web3-providers.tsx
'use client'

import { WagmiProvider, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { http } from 'viem'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import dynamic from 'next/dynamic'

// Corrected import path - match your actual file name
const SolanaProviders = dynamic(
  () => import('./SolanaProviders').then((mod) => mod.default),
  { ssr: false }
)

const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
})

export default function Web3Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <TonConnectUIProvider manifestUrl={process.env.NEXT_PUBLIC_TON_MANIFEST_URL!}>
        <SolanaProviders>
          {children}
        </SolanaProviders>
      </TonConnectUIProvider>
    </WagmiProvider>
  )
}