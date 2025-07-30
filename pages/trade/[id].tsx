import Image from 'next/image'
import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import type { Market } from '@prisma/client'
import dynamic from 'next/dynamic'

const WalletDrawer = dynamic(() => import('../../components/WalletDrawer'), { ssr: false })

type Props = {
  market: Omit<Market, 'eventTime'> & { eventTime: string }
  initialSide: 'yes' | 'no'
}

export default function TradePage({ market: initialMarket, initialSide }: Props) {
  const [market, setMarket] = useState(initialMarket)
  const [amount, setAmount] = useState('1.0')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const total = market.poolYes + market.poolNo
  const yesPct = total > 0 ? (market.poolYes / total) * 100 : 0
  const noPct = 100 - yesPct
  const side = initialSide === 'yes' ? 'UP' : 'DOWN'

  const handleTrade = async () => {
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) return setMessage('❌ Invalid amount.')

    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: market.id,
          amount: amt,
          side,
        }),
      })

      const json = await res.json()
      if (json.success) {
        setMessage('✅ Trade submitted successfully.')
        if (json.market) setMarket(json.market)
      } else {
        setMessage(`❌ ${json.error}`)
      }
    } catch (err) {
      console.error(err)
      setMessage('❌ Server error.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="trade-wrapper min-h-screen bg-white text-black font-[Montserrat]">
      {/* Header */}
      <header className="trade-header flex items-center justify-between px-4 py-4">
        <Image src="/logo.png" alt="Tovo" width={60} height={20} className="trade-logo" />
        <button onClick={() => setDrawerOpen(true)} className="w-6 h-6">
          <Image src="/connect wallet.svg" alt="Connect" width={24} height={24} />
        </button>
      </header>

      {/* Main content */}
      <main className="trade-main px-4 py-4 max-w-md mx-auto">
        <div className="trade-heading text-center mb-6">
          <h1 className="text-[#00B89F] uppercase text-sm font-semibold tracking-wide">
            Prediction Markets Today
          </h1>
        </div>

        <div className="trade-card bg-[#003E37] rounded-xl px-6 py-8 text-center space-y-4 text-white">
          <h2 className="trade-question text-xl font-semibold">{market.question}</h2>
          <p className="trade-timer text-sm text-gray-300">
            Ends on {new Date(market.eventTime).toLocaleString('en-US')}
          </p>
          <p className="trade-percentages text-sm font-medium text-gray-200">
            {yesPct.toFixed(1)}% Yes — <strong>{noPct.toFixed(1)}% No</strong>
          </p>

          <div className="trade-progress h-2 w-full bg-[#E5E5E5] rounded-full overflow-hidden">
            <div
              className="trade-progress-fill h-full bg-[#00B89F]"
              style={{ width: `${yesPct}%` }}
            />
          </div>

          <div className="trade-buttons flex justify-center gap-4 mt-4">
            <button
              onClick={() => setAmount('1.0')}
              className="btn btn-yes w-24 py-2 border border-white rounded-full font-medium hover:bg-white hover:text-black"
            >
              Yes
            </button>
            <button
              onClick={() => setAmount('1.0')}
              className="btn btn-no w-24 py-2 border border-white rounded-full font-medium hover:bg-white hover:text-black"
            >
              No
            </button>
          </div>

          <div className="trade-form mt-4 space-y-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="trade-input w-full p-2 rounded-md border border-gray-300 text-sm text-black"
              placeholder="Enter amount"
            />

            <button
              onClick={handleTrade}
              disabled={loading}
              className="trade-submit w-full bg-[#00B89F] text-white font-semibold py-2 rounded-md"
            >
              {loading ? 'Placing bet...' : 'Confirm Bet'}
            </button>
          </div>

          {message && <div className="trade-message text-sm mt-2">{message}</div>}
        </div>
      </main>

      <WalletDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const { id, side } = ctx.query
  const { prisma } = await import('../../lib/prisma')
  const m = await prisma.market.findUnique({ where: { id: String(id) } })
  if (!m) return { notFound: true }

  return {
    props: {
      market: { ...m, eventTime: m.eventTime.toISOString() },
      initialSide: side === 'no' ? 'no' : 'yes',
    },
  }
}
