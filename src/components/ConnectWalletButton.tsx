// src/components/ConnectWalletButton.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useEthereum } from '../../contexts/EthereumContext'

export function ConnectWalletButton() {
  const { provider } = useEthereum()
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string|null>(null)

  // on mount, see if already connected
  useEffect(() => {
    provider
      ?.request({ method: 'eth_accounts' })
      .then((accounts: unknown) => {
        if (Array.isArray(accounts) && accounts[0]) {
          setAddress(accounts[0] as string)
        }
      })
      .catch(() => {
        /* ignore */
      })
  }, [provider])

  const handleConnect = useCallback(async () => {
    setError(null)
    if (!provider) {
      setError('No Ethereum provider found')
      return
    }

    setIsConnecting(true)
    try {
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as string[]

      if (accounts.length > 0) {
        setAddress(accounts[0])
      } else {
        setError('No account returned')
      }
    } catch (err: any) {
      if (err.code === 4001) {
        // user rejected
        setError('Connection request was rejected')
      } else {
        console.error(err)
        setError('An unexpected error occurred')
      }
    } finally {
      setIsConnecting(false)
    }
  }, [provider])

  // If already connected, show the truncated address
  if (address) {
    const short = `${address.slice(0, 6)}…${address.slice(-4)}`
    return (
      <button className="btn border border-gray-700 px-4 py-2 rounded">
        ✅ {short}
      </button>
    )
  }

  // Otherwise, show the connect button + any error
  return (
    <div>
      <button
        type="button"
        className={`btn px-4 py-2 rounded ${
          isConnecting
            ? 'bg-gray-500 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
        } text-white`}
        onClick={handleConnect}
        disabled={isConnecting}
      >
        {isConnecting ? 'Connecting…' : 'Connect Wallet'}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
