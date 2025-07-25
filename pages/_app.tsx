import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ErrorBoundary } from '../components/ErrorBoundary'

// Wagmi v2 + RainbowKit + TanStack Query for EVM
import { configureChains, createConfig, WagmiConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { publicProvider } from 'wagmi/providers/public'
import { getDefaultWallets, RainbowKitProvider, ConnectButton } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Solana wallet adapter
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'

// TON Connect UI
import { TonConnectUIProvider, TonConnectButton } from '@tonconnect/ui-react'

// Configure chains & providers for Wagmi
const { chains, publicClient } = configureChains(
  [mainnet],
  [publicProvider()]
)

const { connectors } = getDefaultWallets({
  appName: 'Tovo Prediction',
  chains,
})

// Wagmi client config
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
})

// TanStack Query
const queryClient = new QueryClient()

export default function MyApp({ Component, pageProps }: AppProps) {
  // Solana network and wallets
  const solanaNetwork = WalletAdapterNetwork.Mainnet
  const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
  const solanaWallets = [new PhantomWalletAdapter()]

  return (
    <ErrorBoundary>
      {/* TON Connect wrapper */}
      <TonConnectUIProvider manifestUrl={process.env.NEXT_PUBLIC_TON_MANIFEST_URL!}>
        {/* Solana wallet adapter */}
        <ConnectionProvider endpoint={solanaEndpoint}>
          <SolanaWalletProvider wallets={solanaWallets} autoConnect>
            <WalletModalProvider>
              {/* React Query & Wagmi & RainbowKit providers */}
              <QueryClientProvider client={queryClient}>
                <WagmiConfig config={wagmiConfig}>
                  <RainbowKitProvider chains={chains} showRecentTransactions={false}>
                    {/* Global Wallet Selection UI */}
                    <div className="wallet-selection-modal fixed inset-0 bg-[rgba(0,0,0,0.8)] flex flex-col items-center justify-center p-6">
                      <h2 className="text-2xl text-white font-semibold mb-6">
                        Select your USDT or USDC wallet on one of these networks
                      </h2>

                      {/* EVM */}
                      <div className="mb-4 w-full max-w-xs">
                        <ConnectButton chainStatus="none" showBalance={false} label="Connect Ethereum Wallet" />
                      </div>

                      {/* TON */}
                      <div className="mb-4 w-full max-w-xs">
                        <TonConnectButton className="w-full py-3 text-center" />
                      </div>

                      {/* Solana */}
                      <div className="w-full max-w-xs">
                        <WalletMultiButton className="w-full" />
                      </div>

                    </div>

                    <Component {...pageProps} />
                  </RainbowKitProvider>
                </WagmiConfig>
              </QueryClientProvider>
            </WalletModalProvider>
          </SolanaWalletProvider>
        </ConnectionProvider>
      </TonConnectUIProvider>
    </ErrorBoundary>
  )
}
