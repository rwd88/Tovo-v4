'use client'
import { useState, useEffect } from 'react'
import { useEthereum } from '../../contexts/EthereumContext'
import { useSolana } from '../../contexts/SolanaContext'
import { useTon } from '../../contexts/TonContext'

export const ConnectWalletButton = () => {
  const [mounted, setMounted] = useState(false)
  const { address: ethAddress } = useEthereum()
  const { publicKey: solAddress } = useSolana()
  const { address: tonAddress } = useTon()

  // Fix hydration issues
  useEffect(() => setMounted(true), [])

  if (!mounted) return (
    <button className="btn" disabled>
      Loading...
    </button>
  )

  const activeAddress = ethAddress || solAddress?.toString() || tonAddress

  return (
    <div className="wallet-connector">
      {activeAddress ? (
        <div className="dropdown">
          <button className="btn">
            {`${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}`}
          </button>
          <div className="dropdown-content">
            <button onClick={() => navigator.clipboard.writeText(activeAddress)}>
              Copy address
            </button>
            <button onClick={() => window.ethereum?.request({ method: 'wallet_requestPermissions' })}>
              Change wallet
            </button>
            <button onClick={() => {
              if (ethAddress) disconnectEth()
              if (solAddress) disconnectSol()
              if (tonAddress) disconnectTon()
            }}>
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn--blue" onClick={handleConnect}>
          Connect Wallet
        </button>
      )}
    </div>
  )
}