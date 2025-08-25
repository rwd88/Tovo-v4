'use client';

import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { COUNTER_ADDRESS, COUNTER_ABI } from '../lib/contracts';
import { useState } from 'react';

export default function CounterClient() {
  const { isConnected } = useAccount();

  const { data: value, refetch, isPending: reading } = useReadContract({
    address: COUNTER_ADDRESS,
    abi: COUNTER_ABI,
    functionName: 'value',
  });

  const { writeContractAsync, isPending: writing } = useWriteContract();
  const [txHash, setTxHash] = useState<string | null>(null);

  async function increment() {
    const hash = await writeContractAsync({
      address: COUNTER_ADDRESS,
      abi: COUNTER_ABI,
      functionName: 'increment',
    });
    setTxHash(hash as string);
    await refetch();
  }

  if (!isConnected) return <button onClick={() => (window as any).ethereum?.request({ method: 'eth_requestAccounts' })}>Connect Wallet</button>;

  return (
    <div style={{ display:'grid', gap:12 }}>
      <div>Counter (Sepolia): {reading ? '…' : String(value ?? 0)}</div>
      <button disabled={writing} onClick={increment}>
        {writing ? 'Sending…' : 'Increment'}
      </button>
      {txHash && (
        <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
          View tx
        </a>
      )}
    </div>
  );
}
