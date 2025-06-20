import React, { useEffect, useState } from "react"
import { useEthereum } from "../contexts/EthereumContext"

type Market = {
  id: string
  question: string
}

export default function TradeForm() {
  const { address } = useEthereum()
  const [markets, setMarkets] = useState<Market[]>([])
  const [marketId, setMarketId] = useState<string>("")
  const [side, setSide] = useState<"UP"|"DOWN">("UP")
  const [amount, setAmount] = useState<number>(0)
  const [status, setStatus] = useState<string|null>(null)

  // 1) Fetch markets on mount
  useEffect(() => {
    fetch("/api/markets")
      .then(res => res.json())
      .then((data: Market[]) => {
        setMarkets(data)
        if (data.length) setMarketId(data[0].id)
      })
      .catch(console.error)
  }, [])

  // 2) Form submit handler
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!address) {
      setStatus("Connect your wallet first.")
      return
    }
    setStatus("Sending trade…")

    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId, side, amount, walletAddress: address }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Unknown error")
      setStatus(`Trade successful! You ${side} ${amount}`)
    } catch (err: any) {
      console.error(err)
      setStatus("Error: " + err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded">
      <h2 className="text-xl font-semibold">Place a Bet</h2>

      <div>
        <label className="block mb-1">Market</label>
        <select
          value={marketId}
          onChange={e => setMarketId(e.target.value)}
          className="w-full p-2 border rounded"
        >
          {markets.map(m => (
            <option key={m.id} value={m.id}>
              {m.question}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block mb-1">Side</label>
        <div className="flex gap-4">
          {["UP", "DOWN"].map(s => (
            <label key={s} className="inline-flex items-center">
              <input
                type="radio"
                name="side"
                value={s}
                checked={side === s}
                onChange={() => setSide(s as "UP"|"DOWN")}
                className="mr-2"
              />
              {s === "UP" ? "Yes/Up" : "No/Down"}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block mb-1">Amount</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={e => setAmount(parseFloat(e.target.value))}
          className="w-full p-2 border rounded"
        />
      </div>

      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        disabled={!marketId || amount <= 0}
      >
        Submit Bet
      </button>

      {status && <p className="mt-2 text-sm">{status}</p>}
    </form>
  )
}
