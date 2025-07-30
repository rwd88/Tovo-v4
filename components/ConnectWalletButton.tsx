"use client"
import { useEthereum } from "../contexts/EthereumContext"
import dynamic from "next/dynamic"
import { TonConnectButton, useTonConnectUI } from "@tonconnect/ui-react"
import QRCode from "react-qr-code"
import { QRCodeModal } from '@walletconnect/qrcode-modal'
import { useState } from 'react'

const SolanaWalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
)

export default function ConnectWalletButton() {
  const { connect, disconnect, address } = useEthereum()
  const [showEVMQR, setShowEVMQR] = useState(false)
  const [walletConnectURI, setWalletConnectURI] = useState('')

  const handleEVMConnect = async () => {
    if (address) {
      await disconnect()
      return
    }
    
    const { uri } = await connect()
    if (uri) {
      setWalletConnectURI(uri)
      setShowEVMQR(true)
      QRCodeModal.open(uri, () => {
        setShowEVMQR(false)
        QRCodeModal.close()
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* EVM Wallet */}
      <button
        onClick={handleEVMConnect}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        {address ? `Disconnect: ${address.slice(0,6)}...` : "Connect EVM"}
      </button>
      
      {showEVMQR && (
        <div className="p-4 bg-white rounded-lg">
          <QRCode value={walletConnectURI} size={256} />
        </div>
      )}

      {/* TON Wallet */}
      <TonConnectButton />

      {/* Solana Wallet */}
      <SolanaWalletMultiButton />
    </div>
  )
}