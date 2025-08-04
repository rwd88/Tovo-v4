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

  const handleClick = async (wallet: 'metamask' | 'trust') => {
    try {
      if (address) {
        await disconnect()
        return
      }

      await connect(wallet)
    } catch (error) {
      console.error('Wallet connection failed:', error)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {address ? (
        <button
          onClick={() => disconnect()}
          className="bg-red-500 hover:bg-red-600 text-white font-semibold px-5 py-2 rounded"
        >
          Disconnect: {address.slice(0, 6)}...{address.slice(-4)}
        </button>
      ) : (
        <>
          <button
            onClick={() => handleClick('metamask')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded w-full"
          >
            Connect MetaMask
          </button>
          <button
            onClick={() => handleClick('trust')}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded w-full"
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
