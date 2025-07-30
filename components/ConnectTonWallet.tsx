"use client"
import { TonConnectButton, useTonConnectUI } from "@tonconnect/ui-react"
import QRCode from "react-qr-code"
import { useState, useEffect } from 'react'

export default function ConnectTonWallet() {
  const [tonConnectUI] = useTonConnectUI()
  const [qrUri, setQrUri] = useState('')

  useEffect(() => {
    const unsubscribe = tonConnectUI.onStatusChange((wallet) => {
      if (wallet?.connectItems?.tonProof && 'link' in wallet.connectItems.tonProof) {
        setQrUri(wallet.connectItems.tonProof.link)
      }
    })
    return () => unsubscribe()
  }, [tonConnectUI])

  return (
    <div className="mb-4">
      <TonConnectButton />
      {qrUri && (
        <div className="mt-4 p-4 bg-white rounded-lg">
          <QRCode value={qrUri} size={180} />
        </div>
      )}
    </div>
  )
}