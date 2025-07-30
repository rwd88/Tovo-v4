// lib/wagmi.ts
import { createConfig, configureChains } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { http } from 'wagmi'
import { injected } from 'wagmi/connectors'

const { chains, publicClient } = configureChains(
  [mainnet],
  [http(process.env.NEXT_PUBLIC_ETH_RPC_URL!)]
)

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [
    injected({ chains })
  ],
  publicClient,
})
