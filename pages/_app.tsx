import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ErrorBoundary } from '../components/ErrorBoundary'

// Wagmi v2 + TanStack Query
import { WagmiProvider, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { http } from 'viem'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

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
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <Component {...pageProps} />
        </WagmiProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
