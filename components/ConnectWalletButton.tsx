// components/ConnectWalletButton.tsx
import React from 'react'
import { useEthereum } from '@/contexts/EthereumContext'

export default function ConnectWalletButton() {
  const { address, connect, disconnect } = useEthereum()
  return address ? (
    <div>
      Connected: {address.substring(0, 6)}…{address.slice(-4)}
      <button onClick={disconnect}>Disconnect</button>
    </div>
  ) : (
    <button onClick={connect}>Connect MetaMask</button>
  )
}
