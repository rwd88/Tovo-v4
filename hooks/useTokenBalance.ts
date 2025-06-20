import { useState, useEffect } from 'react'
import { Contract } from 'ethers'
import { useEthereum } from '../contexts/EthereumContext'

// Minimal ERC-20 ABI fragment
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
]

/**
 * Given a token contract address, returns the user's balance as a string.
 */
export function useTokenBalance(tokenAddress: string) {
  const { provider, address } = useEthereum()
  const [balance, setBalance] = useState<string>('0.0')

  useEffect(() => {
    if (!provider || !address) return

    let stale = false
    const contract = new Contract(tokenAddress, ERC20_ABI, provider)

    // Fetch decimals + raw balance, then format
    Promise.all([
      contract.decimals() as Promise<number>,
      contract.balanceOf(address) as Promise<bigint>
    ])
      .then(([decimals, raw]) => {
        if (stale) return
        // formatUnits accepts string or BigNumber; raw is bigint so convert
        const formatted = provider.formatter.bigNumber(raw).toString() // fallback
        // Better: use ethers.utils.formatUnits(raw, decimals)
        import('ethers').then(({ utils }) => {
          if (!stale) setBalance(utils.formatUnits(raw.toString(), decimals))
        })
      })
      .catch((err) => {
        console.error('useTokenBalance error', err)
      })

    return () => {
      stale = true
    }
  }, [provider, address, tokenAddress])

  return balance
}
