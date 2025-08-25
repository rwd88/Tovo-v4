// pages/_app.tsx
import '../styles/globals.css'
import type { AppProps } from 'next/app'
import '@fontsource/montserrat'
import { useMemo } from 'react'
import { ErrorBoundary } from '../components/ErrorBoundary'

// Wagmi
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from '../lib/wagmi'

// React Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Solana
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'

// TON
import { TonConnectUIProvider } from '@tonconnect/ui-react'

// Ethereum Context
import { EthereumProvider } from '../contexts/EthereumContext'

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export default function MyApp({ Component, pageProps }: AppProps) {
  const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL as string
  const solanaWallets = useMemo(() => [new PhantomWalletAdapter()], [])

  return (
    <ErrorBoundary>
      <TonConnectUIProvider
        manifestUrl={process.env.NEXT_PUBLIC_TON_MANIFEST_URL!}
        walletsListConfiguration={{
          includeWallets: [
            {
              appName: 'tovo-v4',
              name: 'TON Wallet',
              imageUrl: 'https://wallet.ton.org/assets/tonconnect_logo.png',
              aboutUrl: 'https://ton.org/wallets',
              jsBridgeKey: 'tonconnect',
              bridgeUrl: 'https://bridge.tonapi.io/bridge',
              platforms: ['ios', 'android', 'chrome', 'macos', 'windows'],
            },
          ],
        }}
      >
        <ConnectionProvider endpoint={solanaEndpoint}>
          <SolanaWalletProvider wallets={solanaWallets} autoConnect>
            <WalletModalProvider>
              {/* Wagmi should wrap React Query in v2 */}
              <WagmiProvider config={wagmiConfig}>
                <QueryClientProvider client={queryClient}>
                  <EthereumProvider>
                    <Component {...pageProps} />
                  </EthereumProvider>
                </QueryClientProvider>
              </WagmiProvider>
            </WalletModalProvider>
          </SolanaWalletProvider>
        </ConnectionProvider>
      </TonConnectUIProvider>
    </ErrorBoundary>
  )
}
