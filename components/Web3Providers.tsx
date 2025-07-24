'use client'
import React, { ReactNode } from 'react'

// Ethereum (Using Web3Modal v2 standalone)
import { Web3Modal } from '@web3modal/standalone'
import { BrowserProvider } from 'ethers'

// Solana
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'

// TON
import { TonConnectUIProvider } from '@tonconnect/ui-react'

// Initialize Web3Modal
const web3Modal = new Web3Modal({
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  walletConnectVersion: 2
})

export default function Web3Providers({ children }: { children: ReactNode }) {
  // Validate environment variables
  if (!process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.startsWith('http')) {
    throw new Error('Invalid Solana RPC URL - must start with http:// or https://')
  }

  return (
    <>
      {/* Solana Provider */}
      <ConnectionProvider endpoint={process.env.NEXT_PUBLIC_SOLANA_RPC_URL}>
        <WalletProvider wallets={[new PhantomWalletAdapter()]} autoConnect>
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

// Ethereum connection helper
export async function connectEthereum() {
  const provider = await web3Modal.openModal()
  const ethersProvider = new BrowserProvider(provider)
  return {
    address: await (await ethersProvider.getSigner()).getAddress(),
    provider: ethersProvider
  }
}