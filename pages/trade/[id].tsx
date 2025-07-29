import Image from 'next/image'
import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import type { Market } from '@prisma/client'
import { useEthereum } from '../../src/contexts/EthereumContext'

type Props = {
  market: Omit<Market, 'eventTime'> & { eventTime: string }
  initialSide: 'yes' | 'no'
}

export default function TradePage({ market: initialMarket, initialSide }: Props) {
  const { address } = useEthereum()

  const [market, setMarket] = useState(initialMarket)
  const [chosenSide, setChosenSide] = useState<'yes' | 'no'>(initialSide)
  const [amount, setAmount] = useState<string>('1.0')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const total = market.poolYes + market.poolNo
  const yesPct = total > 0 ? (market.poolYes / total) * 100 : 0

  const handleTrade = async () => {
    if (!address) {
      return setMessage('❌ Connect your wallet first.')
    }

    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      return setMessage('❌ Invalid amount.')
    }

    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: market.id,
          walletAddress: address,
          amount: amt,
          side: chosenSide === 'yes' ? 'UP' : 'DOWN',
        }),
      })

      const json = await res.json()
      if (json.success) {
        setMessage('✅ Trade submitted successfully.')
        if (json.market) {
          setMarket(json.market)
        }
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
    <div className="min-h-screen bg-[#2C2F3A] text-white">
      <header className="flex items-center p-4 bg-[#15463D]">
        <Image src="/logo.png" alt="Tovo" width={32} height={32} />
        <h1 className="ml-2 font-bold text-xl">Tovo</h1>
      </header>

      <main className="px-4 py-8 max-w-md mx-auto">
        <div className="bg-[#15463D] rounded-2xl p-6 space-y-4">
          <h2 className="text-2xl font-semibold">{market.question}</h2>
          <p className="text-gray-300">
            Ends: {new Date(market.eventTime).toUTCString()}
          </p>

          <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-[#43E1C8]"
              style={{ width: `${yesPct}%` }}
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#43E1C8]">{yesPct.toFixed(1)}% Yes</span>
            <span className="text-pink-400">{(100 - yesPct).toFixed(1)}% No</span>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={() => setChosenSide('yes')}
              className={`flex-1 py-2 rounded-full font-medium ${
                chosenSide === 'yes'
                  ? 'bg-[#43E1C8] text-[#15463D]'
                  : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              Yes
            </button>
            <button
              onClick={() => setChosenSide('no')}
              className={`flex-1 py-2 rounded-full font-medium ${
                chosenSide === 'no'
                  ? 'bg-[#43E1C8] text-[#15463D]'
                  : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              No
            </button>
          </div>

          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full mt-2 p-2 rounded bg-gray-800 text-white"
            placeholder="Enter amount"
          />

          <button
            onClick={handleTrade}
            disabled={loading}
            className="w-full mt-2 py-2 bg-[#43E1C8] text-[#15463D] rounded-full font-bold"
          >
            {loading ? 'Placing bet...' : 'Confirm Bet'}
          </button>

          {message && (
            <div className="text-sm text-center mt-2">
              {message}
            </div>
          )}
        </div>
      </main>
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
