// src/components/NavBar.tsx
import React, { useMemo } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import Web3Modal from 'web3modal'
import { BrowserProvider } from 'ethers'

// Solana
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react'
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'

// TON (disable SSR)
const TonConnectButton = dynamic(
  () => import('@tonconnect/ui-react').then(mod => mod.TonConnectButton),
  { ssr: false }
)

export default function Navbar() {
  // EVM Web3Modal setup
  const web3Modal = useMemo(
    () =>
      new Web3Modal({
        cacheProvider: true,
      }),
    []
  )

  async function connectEvm() {
    try {
      const instance = await web3Modal.connect()
      const provider = new BrowserProvider(instance)
      // Get the signer instance
      const signer = await provider.getSigner()
      // Then get the address from the signer
      const address = await signer.getAddress()
      console.log('EVM wallet connected', address)
    } catch (err) {
      console.error('EVM connect error', err)
    }
  }

  // Solana wallet adapters list
  const solanaWallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  )

  return (
    <nav className="flex items-center justify-between p-4 bg-gray-800 text-white">
      <div className="flex items-center space-x-6">
        <Link href="/">
          <a className="text-xl font-bold">Tovo</a>
        </Link>
        <button
          onClick={connectEvm}
          className="px-4 py-2 bg-green-600 rounded hover:bg-green-500"
        >
          Connect EVM Wallet
        </button>
      </div>

      <div className="flex items-center space-x-4">
        {/* Solana wallets */}
        <ConnectionProvider endpoint={process.env.NEXT_PUBLIC_SOLANA_RPC!}>
          <WalletProvider wallets={solanaWallets} autoConnect>
            <WalletModalProvider>
              <WalletMultiButton className="px-4 py-2 bg-purple-600 rounded hover:bg-purple-500" />
            </WalletModalProvider>
          </WalletProvider>
        </ConnectionProvider>

        {/* TON Wallet via TonConnect */}
        <TonConnectButton
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500"
          buttonText="Connect TON Wallet"
        />
      </div>
    </nav>
  )
}
