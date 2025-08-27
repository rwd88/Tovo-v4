// pages/_app.tsx
import '../styles/globals.css'
import type { AppProps } from 'next/app'
import '@fontsource/montserrat'
import { useEffect, useMemo, useState } from 'react'
import { ErrorBoundary } from '../components/ErrorBoundary'

// Wagmi
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from '../lib/wagmi'

// React Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Solana (client-only)
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'

// TON (client-only)
import { TonConnectUIProvider } from '@tonconnect/ui-react'

// Ethereum Context (SSR-safe)
import { EthereumProvider } from '../contexts/EthereumContext'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})

export default function MyApp({ Component, pageProps }: AppProps) {
  const [isClient, setIsClient] = useState(false)
  useEffect(() => setIsClient(true), [])

  const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || ''
  const solanaWallets = useMemo(() => (isClient ? [new PhantomWalletAdapter()] : []), [isClient])

  // 👉 Always render Wagmi/Query/EthereumProvider so hooks are safe in SSR.
  //    Gate TON/Solana wrappers to client only.
  return (
    <ErrorBoundary>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <EthereumProvider>
            {isClient ? (
              <TonConnectUIProvider
                manifestUrl={process.env.NEXT_PUBLIC_TON_MANIFEST_URL || ''}
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
                      <Component {...pageProps} />
                    </WalletModalProvider>
                  </SolanaWalletProvider>
                </ConnectionProvider>
              </TonConnectUIProvider>
            ) : (
              <Component {...pageProps} />
            )}
          </EthereumProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  )
}
