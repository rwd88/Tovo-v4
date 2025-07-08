// src/contexts/SolanaContext.tsx
import React, { createContext, useContext, ReactNode } from "react"
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react"
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets"
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui"
import { clusterApiUrl } from "@solana/web3.js"

require("@solana/wallet-adapter-react-ui/styles.css")

const SolanaContext = createContext({})

export const useSolana = () => useContext(SolanaContext)

export const SolanaProvider = ({ children }: { children: ReactNode }) => {
  const endpoint = clusterApiUrl("mainnet-beta")
  const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()]

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <SolanaContext.Provider value={{}}>
            {children}
          </SolanaContext.Provider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
