// pages/admin/trades.tsx
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { Trade } from '@prisma/client'
import styles from '../../styles/Home.module.css'  // or wherever your CSS lives

type TradeWithMarket = Trade & {
  market: {
    id: string
    externalId: string
    question: string
    eventTime: string
  }
}

export default function AdminTradesPage() {
  const [trades, setTrades] = useState<TradeWithMarket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string|undefined>()

  useEffect(() => {
    fetch('/api/admin/trades')
      .then(res => res.json())
      .then(json => {
        if (json.success) {
          setTrades(json.trades)
        } else {
          setError(json.error || 'Unknown error')
        }
      })
      .catch(err => {
        console.error(err)
        setError(err.message)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <Head>
        <title>Admin – Trades</title>
      </Head>
      <div className={styles.page}>
        <main className={styles.main}>
          <h1 className="text-2xl mb-4">All Trades</h1>
          {loading && <p>Loading…</p>}
          {error && <p className="text-red-500">Error: {error}</p>}
          {!loading && !error && (
            <table className="min-w-full border">
              <thead>
                <tr>
                  <th className="border px-2">Trade ID</th>
                  <th className="border px-2">Market</th>
                  <th className="border px-2">User</th>
                  <th className="border px-2">Side</th>
                  <th className="border px-2">Amt</th>
                  <th className="border px-2">Fee</th>
                  <th className="border px-2">Payout</th>
                  <th className="border px-2">Shares</th>
                  <th className="border px-2">Settled?</th>
                  <th className="border px-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id}>
                    <td className="border px-2">{t.id}</td>
                    <td className="border px-2">{t.market.question}</td>
                    <td className="border px-2">{t.userId}</td>
                    <td className="border px-2">{t.type}</td>
                    <td className="border px-2">{t.amount}</td>
                    <td className="border px-2">{t.fee.toFixed(4)}</td>
                    <td className="border px-2">{t.payout.toFixed(4)}</td>
                    <td className="border px-2">{t.shares}</td>
                    <td className="border px-2">{t.settled ? 'Yes' : 'No'}</td>
                    <td className="border px-2">
                      {new Date(t.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </main>
      </div>
    </>
  )
}
