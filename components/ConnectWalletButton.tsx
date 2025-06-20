import React from 'react'
import { useEthereum } from '@/contexts/EthereumContext'

export default function ConnectWalletButton() {
  const { address, connect, disconnect } = useEthereum()

  if (address) {
    return (
      <div>
        <p>Connected: {address.substring(0, 6)}…{address.slice(-4)}</p>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    )
  }

  return <button onClick={connect}>Connect MetaMask</button>
}
