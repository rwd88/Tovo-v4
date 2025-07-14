// pages/_app.tsx
"use client"

import "../styles/globals.css"
import type { AppProps } from "next/app"

// ─── wagmi & rainbowkit ───────────────────────────────────────────────
import {
  WagmiConfig,
  createConfig,
  configureChains,
  mainnet,
} from "wagmi"
import { publicProvider } from "@wagmi/core/providers/public"

import { getDefaultWallets, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit"
import "@rainbow-me/rainbowkit/styles.css"

// 1) configureChains gives you publicClient + webSocketPublicClient
const { chains, publicClient, webSocketPublicClient } = configureChains(
  [mainnet],
  [
    // note the import from @wagmi/core above, _not_ from "wagmi/providers/…"
    publicProvider(),
  ]
)

// 2) getDefaultWallets gives you a set of connectors (Metamask, WalletConnect, etc)
const { connectors } = getDefaultWallets({
  appName: "Tovo Prediction Markets",
  chains,
})

// 3) createConfig to pass into WagmiConfig
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
  webSocketPublicClient,
})

// ─── TON ────────────────────────────────────────────────────────────────
import { TonConnectUIProvider } from "@tonconnect/ui-react"
import { TonProvider } from "../contexts/TonContext"

// ─── your custom Ethereum (viem) context ───────────────────────────────
import { EthereumProvider } from "../contexts/EthereumContext"

// ─── Solana ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────

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
