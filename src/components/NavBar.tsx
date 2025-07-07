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

  // only run on client
  useEffect(() => {
    console.log('⚙️ NavBar useEffect — mounting on client')
    setMounted(true)
    console.log('⚙️ NavBar mounted → true')
  }, [])

  // instantiate Web3Modal once hydrated
  const web3Modal = useMemo(() => {
    console.log('⚙️ NavBar useMemo — mounted=', mounted)
    if (!mounted) return null
    return new Web3Modal({ cacheProvider: true })
  }, [mounted])

  console.log('⚙️ NavBar render — mounted=', mounted, 'web3Modal=', web3Modal)

  async function connectEvm() {
    if (!web3Modal) return
    const instance  = await web3Modal.connect()
    const provider  = new BrowserProvider(instance)
    const signer    = await provider.getSigner()
    const address   = await signer.getAddress()
    console.log('🔗 EVM address set:', address)
    setEvmAddress(address)
  }

  function disconnectEvm() {
    web3Modal?.clearCachedProvider()
    console.log('🔌 EVM disconnected')
    setEvmAddress(null)
  }

  if (!mounted) return null

  return (
    <nav style={{
      display:    'flex',
      gap:        '1rem',
      padding:    '1rem',
      background: '#111',
      color:      '#fff',
    }}>
      {/* EVM Connector */}
      {evmAddress ? (
        <button onClick={disconnectEvm}>
          Disconnect {evmAddress.slice(0,6)}…{evmAddress.slice(-4)}
        </button>
      ) : (
        <button onClick={connectEvm}>Connect MetaMask</button>
      )}

      {/* Solana Connector */}
      <WalletMultiButton />

      {/* TON Connector */}
      <TonConnectButton />
    </nav>
  )
}
