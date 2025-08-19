// pages/chain-health.tsx
import { useEffect, useState } from "react";
import { getReadContract, getWriteContract } from "@/lib/contract-instance";
import { CONTRACT_ADDRESS } from "@/lib/contracts";

type Health = {
  network: string;
  chainId: number;
  blockNumber: number;
  contractDeployed: boolean;
  contractAddress: string;
  codeSize: number;
};

export default function ChainHealth() {
  const [health, setHealth] = useState<Health | null>(null);
  const [readValue, setReadValue] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");

  useEffect(() => {
    fetch("/api/chain/health")
      .then(r => r.json())
      .then(setHealth)
      .catch(e => console.error(e));
  }, []);

  // Try a read function safely (works if your ABI has e.g. "count()" or "owner()" or similar)
  async function doRead() {
    try {
      const c = getReadContract();
      // 👇 Pick a view method that exists in your ABI:
      const candidates = ["count", "current", "owner", "name"]; // auto-try a few
      for (const fn of candidates) {
        if (fn in c) {
          const v = await (c as any)[fn]();
          setReadValue(`${fn}(): ${v?.toString?.() ?? String(v)}`);
          return;
        }
      }
      setReadValue("No known read function found. Adjust code to your ABI.");
    } catch (e: any) {
      setReadValue("Read error: " + e.message);
    }
  }

  // Example write (adjust to your contract, e.g. increment(), createMarket(...), etc.)
  async function doWrite() {
    try {
      const c = await getWriteContract();
      // change this to match your contract's write method:
      const candidates = ["increment", "set", "poke"];
      for (const fn of candidates) {
        if (fn in c) {
          const tx = await (c as any)[fn](); // no args version
          const rec = await tx.wait();
          setTxHash(rec?.hash ?? tx?.hash ?? "");
          return;
        }
      }
      alert("No known write method guessed. Open this file and replace doWrite() with your actual function call.");
    } catch (e: any) {
      alert("Write error: " + e.message);
    }
  }

  return (
    <div style={{maxWidth: 720, margin: "40px auto", padding: 24}}>
      <h1>Chain Health</h1>
      <p><b>Contract:</b> {CONTRACT_ADDRESS}</p>
      <pre style={{background:"#111", color:"#0f0", padding:12, borderRadius:8}}>
        {health ? JSON.stringify(health, null, 2) : "Loading..."}
      </pre>

      <h2>Try a Read</h2>
      <button onClick={doRead} style={{padding:"8px 16px"}}>Read</button>
      <p>{readValue}</p>

      <h2>Try a Write</h2>
      <button onClick={doWrite} style={{padding:"8px 16px"}}>Connect & Send Tx</button>
      {txHash && (
        <p>Tx: <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">{txHash}</a></p>
      )}
    </div>
  );
}
