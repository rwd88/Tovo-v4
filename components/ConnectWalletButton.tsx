'use client'

import { useEthereum } from '../contexts/EthereumContext'
import dynamic from 'next/dynamic'
import { TonConnectButton } from '@tonconnect/ui-react'

const SolanaWalletMultiButton = dynamic(
  async () =>
    (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
)

export default function ConnectWalletButton() {
  const { connect, disconnect, address } = useEthereum()

  const handleClick = async () => {
    try {
      address ? await disconnect() : await connect()
    } catch (error) {
      console.error('Wallet action failed:', error)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleClick}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded transition duration-200"
      >
        {address ? `Disconnect: ${address.slice(0, 6)}...${address.slice(-4)}` : 'Connect MetaMask'}
      </button>
      <TonConnectButton />
      <SolanaWalletMultiButton />
    </div>
  )
}
