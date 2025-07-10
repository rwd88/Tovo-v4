import { useEffect, useState } from "react"

export default function ActiveMarkets() {
  const [markets, setMarkets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchMarkets() {
      try {
        const res = await fetch("/api/markets")
        const data = await res.json()
        setMarkets(data)
      } catch (err) {
        console.error("Error loading markets:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchMarkets()
  }, [])

  if (loading) return <div>Loading...</div>
  if (!markets || markets.length === 0) return <div>No active markets</div>

  return (
    <div>
      <h1>Active Markets</h1>
      <ul>
        {markets.map((market) => (
          <li key={market.id}>
            {market.question} – {market.status || 'Unknown status'}
          </li>
        ))}
      </ul>
    </div>
  )
}
