// lib/wagmi.ts
import { mainnet } from 'wagmi/chains'
import { http } from 'viem'
import { createConfig } from 'wagmi'
import { InjectedConnector } from '@wagmi/connectors/injected'

export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: [
    new InjectedConnector({
      chains: [mainnet],
      options: {
        name: 'MetaMask',
        shimDisconnect: true,
      },
    }),
  ],
  transports: {
    [mainnet.id]: http(process.env.NEXT_PUBLIC_ETH_RPC_URL!),
  },
  ssr: true,
  autoConnect: true,
})
