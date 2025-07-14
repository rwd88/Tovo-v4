// pages/_app.tsx
"use client"

import "../styles/globals.css"
import type { AppProps } from "next/app"

// 1️⃣ Wagmi + RainbowKit
import {
  WagmiConfig,
  createConfig,
  configureChains,
  mainnet,
} from "wagmi"
import { publicProvider } from "wagmi/providers/public"
import { InjectedConnector } from "wagmi/connectors/injected"

import {
  getDefaultWallets,
  RainbowKitProvider,
  darkTheme,
} from "@rainbow-me/rainbowkit"
import "@rainbow-me/rainbowkit/styles.css"

// 2️⃣ TON
import { TonConnectUIProvider } from "@tonconnect/ui-react"
import { TonProvider } from "../contexts/TonContext"

// 3️⃣ Your custom Ethereum (viem) context
import { EthereumProvider } from "../contexts/EthereumContext"

// 4️⃣ Solana
import { SolanaProvider } from "../contexts/SolanaContext"
import {
  ConnectionProvider as SolanaConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react"
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets"
import "@solana/wallet-adapter-react-ui/styles.css"

// ────────────────────────────────────────────────────────────────────────────────
// 1) configureChains gives you "publicClient" + "webSocketPublicClient"
const { chains, publicClient, webSocketPublicClient } = configureChains(
  [mainnet],
  [publicProvider()]
)

// 2) getDefaultWallets wires up rainbow-kit’s connectors for you
const { connectors } = getDefaultWallets({
  appName: "Tovo Prediction Markets",
  chains,
})

// 3) createConfig creates your wagmi client
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
  webSocketPublicClient,
})
// ────────────────────────────────────────────────────────────────────────────────

export default function App({ Component, pageProps }: AppProps) {
  const tonManifestUrl = process.env.NEXT_PUBLIC_TON_MANIFEST_URL!
  const solanaEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL!
  const solanaWallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ]

  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider chains={chains} theme={darkTheme()}>
        <TonConnectUIProvider manifestUrl={tonManifestUrl}>
          <EthereumProvider>
            <SolanaConnectionProvider endpoint={solanaEndpoint}>
              <SolanaWalletProvider wallets={solanaWallets} autoConnect>
                <SolanaProvider>
                  <Component {...pageProps} />
                </SolanaProvider>
              </SolanaWalletProvider>
            </SolanaConnectionProvider>
          </EthereumProvider>
        </TonConnectUIProvider>
      </RainbowKitProvider>
    </WagmiConfig>
  )
}
