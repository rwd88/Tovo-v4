import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ErrorBoundary } from '../components/ErrorBoundary'
import '@fontsource/montserrat'

// Wagmi v2 (EVM)
import { WagmiProvider, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { http } from 'viem'

// Query Client
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Solana
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'

// TON
import { TonConnectUIProvider } from '@tonconnect/ui-react'

// ✅ EthereumContext
import { EthereumProvider } from '../contexts/EthereumContext'

// Create QueryClient
const queryClient = new QueryClient()

// Wagmi config
const evmConfig = createConfig({
  autoConnect: true,
  publicClient: http(process.env.NEXT_PUBLIC_ETH_RPC_URL!),
  chains: [mainnet],
})

export default function MyApp({ Component, pageProps }: AppProps) {
  const solanaNetwork = WalletAdapterNetwork.Mainnet
  const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
  const solanaWallets = [new PhantomWalletAdapter()]

  return (
    <ErrorBoundary>
      <TonConnectUIProvider manifestUrl={process.env.NEXT_PUBLIC_TON_MANIFEST_URL!}>
        <ConnectionProvider endpoint={solanaEndpoint}>
          <SolanaWalletProvider wallets={solanaWallets} autoConnect>
            <WalletModalProvider>
              <QueryClientProvider client={queryClient}>
                <WagmiProvider config={evmConfig}>
                  {/* ✅ Add Ethereum Context */}
                  <EthereumProvider>
                    <Component {...pageProps} />
                  </EthereumProvider>
                </WagmiProvider>
              </QueryClientProvider>
            </WalletModalProvider>
          </SolanaWalletProvider>
        </ConnectionProvider>
      </TonConnectUIProvider>
    </ErrorBoundary>
  )
}
