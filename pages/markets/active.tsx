// pages/markets/active.tsx
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

type Market = {
  // DB fields
  id: string
  question: string
  eventTime: string
  poolYes: number
  poolNo: number
  // NEW: on-chain numeric id (uint256)
  onchainId?: number | string | null
}

export default function ActiveMarkets() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/markets/active')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setMarkets(data.markets || [])
      })
      .catch(() => setError('Failed to load markets'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-center">Loading…</p>
  if (error) return <p className="text-red-500 text-center">{error}</p>
  if (!markets.length) return <p className="text-center">No active markets available.</p>

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-4">Active Markets</h1>
      <ul className="space-y-4">
        {markets.map((m) => {
          const hasOnchain = m.onchainId !== null && m.onchainId !== undefined && String(m.onchainId).match(/^\d+$/)
          return (
            <li key={m.id} className="border p-4 rounded-md">
              <p className="font-medium">{m.question}</p>
              <p className="text-sm text-gray-500">
                Event Time: {new Date(m.eventTime).toLocaleString()}
              </p>

              <div className="mt-3 flex items-center gap-3">
                <Link
                  href={`/trade/${m.id}`}
                  className="inline-block bg-teal-600 text-white text-sm px-3 py-1 rounded"
                >
                  Open
                </Link>
                {hasOnchain ? (
                  <span className="text-xs rounded bg-green-100 text-green-700 px-2 py-1">
                    onchainId: {String(m.onchainId)}
                  </span>
                ) : (
                  <span className="text-xs rounded bg-yellow-100 text-yellow-700 px-2 py-1">
                    ⚠ missing onchainId
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
