"use client"
import { TonConnectButton, useTonConnectUI } from "@tonconnect/ui-react"

export default function ConnectTonWallet() {
  const [tonConnectUI] = useTonConnectUI()
  const connected = tonConnectUI.account?.address

  return (
    <div className="mb-4">
      <TonConnectButton />
      {connected && <p className="mt-2 text-white">TON Address: {connected}</p>}
    </div>
  )
}
