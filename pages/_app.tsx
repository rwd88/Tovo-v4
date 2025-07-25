import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ErrorBoundary } from '../components/ErrorBoundary'

// Wagmi v2 + TanStack Query
import { WagmiProvider, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { http } from 'viem'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// TON Connect UI
import { TonConnectUIProvider } from '@tonconnect/ui-react'

// Setup TanStack Query
const queryClient = new QueryClient()

// Configure Wagmi v2
const config = createConfig({
  autoConnect: true,
  publicClient: http(process.env.NEXT_PUBLIC_ETH_RPC_URL!),
  chains: [mainnet],
})

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      {/* TON Connect wrapper: provide manifest URL for TonConnect */}
      <TonConnectUIProvider manifestUrl={process.env.NEXT_PUBLIC_TON_MANIFEST_URL!}>
        {/* React Query provider */}
        <QueryClientProvider client={queryClient}>
          {/* Wagmi (EVM) provider */}
          <WagmiProvider config={config}>
            <Component {...pageProps} />
          </WagmiProvider>
        </QueryClientProvider>
      </TonConnectUIProvider>
    </ErrorBoundary>
  )
}
