// pages/_app.tsx
import '../styles/globals.css'
import type { AppProps } from 'next/app'
import ClientOnly from '../components/client-only'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Non-wallet providers can stay as regular imports
import { TonProvider } from '../contexts/TonContext'
import { SolanaProvider } from '../contexts/SolanaContext'

const queryClient = new QueryClient()

// Wallet providers as dynamic imports
const Web3Providers = dynamic(
  () => import('../components/web3-providers').then((mod) => mod.default),
  { ssr: false }
)

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ClientOnly>
      <QueryClientProvider client={queryClient}>
        <Web3Providers>
          <TonProvider>
            <SolanaProvider>
              <Component {...pageProps} />
            </SolanaProvider>
          </TonProvider>
        </Web3Providers>
      </QueryClientProvider>
    </ClientOnly>
  )
}