// src/components/ConnectWalletButton.tsx
'use client'

import { useEffect } from 'react'
import { useAccount, useConnect } from 'wagmi'
import { InjectedConnector } from 'wagmi/connectors/injected'

export function ConnectWalletButton() {
  const { connect } = useConnect({
    connector: new InjectedConnector(),
  })
  const { address, isConnecting } = useAccount()

  useEffect(() => {
    if (address) {
      console.log('✅ Connected as', address)
    }
  }, [address])

  if (address) {
    return (
      <button
        type="button"
        className="btn"
      >
        ✅ {address.slice(0, 6)}…
      </button>
    )
  }

  return (
    <button
      type="button"                         // ← explicit non‐submit button
      className="btn bg-blue-500 text-white px-4 py-2 rounded"
      onClick={() => connect()}
      disabled={isConnecting}
    >
      {isConnecting ? 'Connecting…' : 'Connect Wallet'}
    </button>
  )
}
