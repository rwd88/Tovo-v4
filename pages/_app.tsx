// pages/_app.tsx
'use client'

import '../styles/globals.css'
import type { AppProps } from 'next/app'

import { WagmiConfig, createClient, configureChains, mainnet } from 'wagmi'
import { publicProvider } from 'wagmi/providers/public'
import { InjectedConnector } from 'wagmi/connectors/injected'

import { TonConnectUIProvider } from '@tonconnect/ui-react'
import { TonProvider } from '../contexts/TonContext'
import { SolanaProvider } from '../contexts/SolanaContext'
import { EthereumProvider } from '../contexts/EthereumContext'

import {
  ConnectionProvider as SolanaConnectionProvider,
  WalletProvider as SolanaWalletProvider
} from '@solana/wallet-adapter-react'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter
} from '@solana/wallet-adapter-wallets'
import '@solana/wallet-adapter-react-ui/styles.css'

//
// 1) Set up Wagmi (Ethereum) client
//
const { provider, webSocketProvider } = configureChains(
  [mainnet],
  [publicProvider()]
)

const wagmiClient = createClient({
  autoConnect: true,
  connectors: [
    // MetaMask / any injected EIP-1193 wallet
    new InjectedConnector({ chains: [mainnet] }),
  ],
  provider,
  webSocketProvider,
})

//
// 2) Solana RPC endpoint + wallets
//
const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
const solanaWallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()]

//
// 3) TON manifest URL
//
const tonManifestUrl = process.env.NEXT_PUBLIC_TON_MANIFEST_URL!

export default function App({ Component, pageProps }: AppProps) {
  return (
    // 1. WagmiConfig must wrap any useConnect/useAccount hooks
    <WagmiConfig client={wagmiClient}>
      {/* 2. TON */}
      <TonConnectUIProvider manifestUrl={tonManifestUrl}>
        <EthereumProvider>
          {/* 3. Solana */}
          <SolanaConnectionProvider endpoint={solanaEndpoint}>
            <SolanaWalletProvider wallets={solanaWallets} autoConnect>
              <SolanaProvider>
                {/* 4. Your custom TON context (if you need it) */}
                <TonProvider>
                  {/* Finally, your page */}
                  <Component {...pageProps} />
                </TonProvider>
              </SolanaProvider>
            </SolanaWalletProvider>
          </SolanaConnectionProvider>
        </EthereumProvider>
      </TonConnectUIProvider>
    </WagmiConfig>
  )
}
