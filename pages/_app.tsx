import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ErrorBoundary } from '../components/ErrorBoundary'

// Wagmi v2 + TanStack Query (EVM)
import { WagmiProvider, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { http } from 'viem'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Solana wallet adapter
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'

// TON Connect UI
import { TonConnectUIProvider } from '@tonconnect/ui-react'

// Setup TanStack Query
const queryClient = new QueryClient()

// Configure Wagmi v2 for EVM
const evmConfig = createConfig({
  autoConnect: true,
  publicClient: http(process.env.NEXT_PUBLIC_ETH_RPC_URL!),
  chains: [mainnet],
})

export default function MyApp({ Component, pageProps }: AppProps) {
  // Solana network and wallets
  const solanaNetwork = WalletAdapterNetwork.Mainnet
  const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
  const solanaWallets = [new PhantomWalletAdapter()]

  return (
    <ErrorBoundary>
      {/* TON Connect wrapper */}
      <TonConnectUIProvider manifestUrl={process.env.NEXT_PUBLIC_TON_MANIFEST_URL!}>
        {/* Solana wallet adapter provider */}
        <ConnectionProvider endpoint={solanaEndpoint}>
          <SolanaWalletProvider wallets={solanaWallets} autoConnect>
            <WalletModalProvider>
              {/* React Query provider */}
              <QueryClientProvider client={queryClient}>
                {/* Wagmi (EVM) provider */}
                <WagmiProvider config={evmConfig}>
                  <Component {...pageProps} />
                </WagmiProvider>
              </QueryClientProvider>
            </WalletModalProvider>
          </SolanaWalletProvider>
        </ConnectionProvider>
      </TonConnectUIProvider>
    </ErrorBoundary>
  )
}
