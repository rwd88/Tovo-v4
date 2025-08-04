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

  const handleDisconnect = async () => {
    try {
      await disconnect()
    } catch (err) {
      console.error('Failed to disconnect:', err)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {address ? (
        <button
          onClick={handleDisconnect}
          className="bg-gray-700 hover:bg-gray-800 text-white font-semibold px-5 py-2 rounded"
        >
          Disconnect: {address.slice(0, 6)}...{address.slice(-4)}
        </button>
      ) : (
        <>
          <button
            onClick={() => connect('metamask')}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2 rounded"
          >
            Connect MetaMask
          </button>
          <button
            onClick={() => connect('trust')}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded"
          >
            Connect Trust Wallet
          </button>
        </>
      )}

      <TonConnectButton />
      <SolanaWalletMultiButton />
    </div>
  )
}
