// components/ConnectWalletButton.tsx
import React from 'react'
import { useEthereum } from '../contexts/EthereumContext'

export default function ConnectWalletButton() {
  const { address, connect, disconnect } = useEthereum()

  if (address) {
    return (
      <div>
        Connected: {address.substring(0, 6)}…{address.slice(-4)}
        <button onClick={() => { console.log('disconnect clicked'); disconnect() }}>
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => {
        console.log('connect clicked')
        connect()
      }}
    >
      Connect MetaMask
    </button>
  )
}
