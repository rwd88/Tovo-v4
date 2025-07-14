// src/components/ConnectWalletButton.tsx
'use client'

import { useState, useEffect } from 'react'
import { useEthereum } from '../../contexts/EthereumContext'

export function ConnectWalletButton() {
  const client = useEthereum()
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If already connected (e.g. on page reload), fetch accounts
  useEffect(() => {
    async function checkConnected() {
      try {
        const accounts = await (window.ethereum as any)?.request({
          method: 'eth_accounts',
        })
        if (Array.isArray(accounts) && accounts[0]) {
          setAddress(accounts[0] as string)
        }
      } catch {
        // ignore
      }
    }
    checkConnected()
  }, [])

  const handleConnect = async () => {
    setError(null)
    if (!(window.ethereum as any)) {
      setError('No Ethereum provider found')
      return
    }
    setIsConnecting(true)
    try {
      const accounts: string[] = await (window.ethereum as any).request({
        method: 'eth_requestAccounts',
      })
      setAddress(accounts[0])
    } catch (err: any) {
      if (err.code === 4001) {
        // EIP-1193 user rejected
        setError('Connection request rejected')
      } else {
        setError('Unexpected error')
        console.error(err)
      }
    } finally {
      setIsConnecting(false)
    }
  }

  if (address) {
    return (
      <button className="btn">
        ✅ {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        className="btn bg-blue-500 text-white px-4 py-2 rounded"
        onClick={handleConnect}
        disabled={isConnecting}
      >
        {isConnecting ? 'Connecting…' : 'Connect Wallet'}
      </button>
      {error && (
        <p className="mt-2 text-red-500 text-sm">
          {error}
        </p>
      )}
    </>
  )
}
