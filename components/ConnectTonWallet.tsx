// components/ConnectTonWallet.tsx
"use client"
import { TonConnectButton } from "@tonconnect/ui-react"

export default function ConnectTonWallet() {
  return (
    <div className="mb-4">
      <TonConnectButton />
    </div>
  )
}
