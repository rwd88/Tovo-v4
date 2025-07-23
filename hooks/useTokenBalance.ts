// hooks/useTokenBalance.ts
'use client'

import { useState, useEffect } from 'react'
import { Contract, formatUnits } from 'ethers'
import { useEthereum } from '../contexts/EthereumContext'

// Minimal ERC-20 ABI
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
]

export function useTokenBalance(tokenAddress: string): string {
  const { provider, address } = useEthereum()
  const [balance, setBalance] = useState('0.0')

  useEffect(() => {
    if (!provider || !address) return
    let stale = false

    // Create a read-only contract instance
    const contract = new Contract(tokenAddress, ERC20_ABI, provider as any)

    async function fetchBalance() {
      try {
        // Fetch both decimals and raw balance in parallel
        const [decimals, raw] = await Promise.all([
          contract.decimals(),
          contract.balanceOf(address),
        ])
        if (stale) return
        // Format using the standalone import
        const formatted = formatUnits(raw, decimals)
        setBalance(formatted)
      } catch (err) {
        console.error('useTokenBalance error', err)
      }
    }

    fetchBalance()
    return () => {
      stale = true
    }
  }, [provider, address, tokenAddress])

  return balance
}
