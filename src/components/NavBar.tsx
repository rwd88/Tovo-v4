// src/components/NavBar.tsx
'use client'
import React, { useState, useEffect, useMemo } from 'react'
import Web3Modal from 'web3modal'
import { BrowserProvider } from 'ethers'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { TonConnectButton } from '@tonconnect/ui-react'

export default function NavBar() {
  const [mounted, setMounted]       = useState(false)
  const [evmAddress, setEvmAddress] = useState<string | null>(null)

  // Only render after client hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Lazy-init web3modal
  const web3Modal = useMemo(() => {
    if (!mounted) return null
    return new Web3Modal({ cacheProvider: true })
  }, [mounted])

  async function connectEvm() {
    if (!web3Modal) return
    const instance  = await web3Modal.connect()
    const provider  = new BrowserProvider(instance)
    const signer    = await provider.getSigner()
    const address   = await signer.getAddress()
    setEvmAddress(address)
  }

  function disconnectEvm() {
    web3Modal?.clearCachedProvider()
    setEvmAddress(null)
  }

  if (!mounted) return null

  return (
    <nav style={{
      display: 'flex',
      gap:     '1rem',
      padding: '1rem',
      background: '#111',
      color: '#fff'
    }}>
      {/* EVM */}
      {evmAddress ? (
        <button onClick={disconnectEvm}>
          Disconnect {evmAddress.slice(0,6)}…{evmAddress.slice(-4)}
        </button>
      ) : (
        <button onClick={connectEvm}>Connect MetaMask</button>
      )}

      {/* Solana */}
      <WalletMultiButton />

      {/* TON */}
      <TonConnectButton />
    </nav>
  )
}
