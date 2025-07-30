'use client'

import { useEthereum } from '../contexts/EthereumContext'
import dynamic from 'next/dynamic'
import { TonConnectButton } from '@tonconnect/ui-react'

// Dynamically import Solana button (to prevent SSR issues)
const SolanaWalletMultiButton = dynamic(
  async () =>
    (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
)

export default function ConnectWalletButton() {
  const { connect, disconnect, address } = useEthereum()

  const handleClick = async () => {
    try {
      if (address) {
        await disconnect()
      } else {
        await connect()
      }
    } catch (error) {
      console.error('Wallet action failed:', error)
    }
  }

  const renderButtonLabel = () => {
    if (!address) return 'Connect MetaMask'
    return `Disconnect: ${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* EVM (MetaMask or other Injected Wallets) */}
      <button
        onClick={handleClick}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded transition duration-200"
        disabled={!connect}
      >
        {renderButtonLabel()}
      </button>

      {/* TON Connect Button */}
      <TonConnectButton />

      {/* Solana Wallet Connect */}
      <SolanaWalletMultiButton />
    </div>
  )
}
