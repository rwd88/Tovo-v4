'use client'
import React, { ReactNode } from 'react'

// Ethereum (Using Ethers + Web3Modal standalone)
import { Web3Modal } from '@web3modal/standalone'
import { ethers } from 'ethers'

// Solana
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'

// TON
import { TonConnectUIProvider } from '@tonconnect/ui-react'

// Ethereum Web3Modal config
const web3Modal = new Web3Modal({
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  walletConnectVersion: 2
})

// Solana wallets
const solanaWallets = [new PhantomWalletAdapter()]

export default function Web3Providers({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Solana Provider */}
      <ConnectionProvider endpoint={process.env.NEXT_PUBLIC_SOLANA_RPC_URL!}>
        <WalletProvider wallets={solanaWallets} autoConnect>
          <WalletModalProvider>
            
            {/* TON Provider */}
            <TonConnectUIProvider manifestUrl={process.env.NEXT_PUBLIC_TON_MANIFEST_URL!}>
              {children}
            </TonConnectUIProvider>

          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </>
  )
}

// Ethereum helper function (use anywhere in your app)
export async function connectEthereum() {
  const provider = await web3Modal.openModal()
  const ethersProvider = new ethers.BrowserProvider(provider)
  return {
    provider,
    signer: await ethersProvider.getSigner()
  }
}