import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { ErrorBoundary } from '../components/ErrorBoundary'

// Wagmi & RainbowKit imports
import { WagmiConfig, createClient, configureChains, chain } from 'wagmi'
import { publicProvider } from 'wagmi/providers/public'
import { getDefaultWallets, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'

// Set up chains and providers
const { chains, provider } = configureChains(
  [chain.mainnet, chain.polygon, chain.optimism, chain.arbitrum],
  [publicProvider()]
)

// Get default connectors (MetaMask, WalletConnect, etc.)
const { connectors } = getDefaultWallets({
  appName: 'Tovo Prediction',
  chains,
})

// Create Wagmi client
const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
})

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <WagmiConfig client={wagmiClient}>
        <RainbowKitProvider chains={chains} theme={darkTheme()}>
          <Component {...pageProps} />
        </RainbowKitProvider>
      </WagmiConfig>
    </ErrorBoundary>
  )
}
