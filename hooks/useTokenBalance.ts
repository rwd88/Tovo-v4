// hooks/useTokenBalance.ts
import { useState, useEffect } from 'react'
import { Contract, ethers } from 'ethers'
import { useEthereum } from '../contexts/EthereumContext'

// Minimal ERC-20 ABI for balanceOf & decimals
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

    // Cast provider to any so Contract accepts it as a runner
    const contract = new Contract(tokenAddress, ERC20_ABI, provider as any)

    async function fetchBalance() {
      try {
        const decimals: number = await contract.decimals()
        const raw: ethers.BigNumberish = await contract.balanceOf(address)
        if (stale) return
        // v6: use ethers.formatUnits instead of ethers.utils.formatUnits
        const formatted = ethers.formatUnits(raw, decimals)
        setBalance(formatted)
      } catch (err) {
        console.error('useTokenBalance error', err)
      }
    }

    fetchBalance()
    return () => { stale = true }
  }, [provider, address, tokenAddress])

  return balance
}
