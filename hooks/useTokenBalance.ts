'use client';

import { useState, useEffect } from 'react';
import { Contract } from 'ethers';
import { formatUnits } from 'ethers';
import { useEthereum } from '../contexts/EthereumContext';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

export function useTokenBalance(tokenAddress: string): string {
  const { provider, address } = useEthereum();
  const [balance, setBalance] = useState('0.0');

  useEffect(() => {
    if (!provider || !address) return;
    let stale = false;

    const contract = new Contract(tokenAddress, ERC20_ABI, provider);

    async function fetchBalance() {
      try {
        const [decimals, raw] = await Promise.all([
          contract.decimals(),
          contract.balanceOf(address),
        ]);
        if (stale) return;
        setBalance(formatUnits(raw, decimals));
      } catch (err) {
        console.error('useTokenBalance error', err);
      }
    }

    fetchBalance();
    return () => { stale = true; };
  }, [provider, address, tokenAddress]);

  return balance;
}