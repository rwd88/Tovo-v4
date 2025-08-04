'use client'

import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import type { Market } from '@prisma/client'
import { useEthereum } from '../../contexts/EthereumContext'
import dynamic from 'next/dynamic'

const WalletDrawer = dynamic(
  () => import('../../components/WalletDrawer'),
  { ssr: false }
)

type Props = {
  market: Omit<Market, 'eventTime'> & { eventTime: string }
  initialSide: 'yes' | 'no'
}

export default function TradePage({ market: initialMarket, initialSide }: Props) {
  const { address } = useEthereum()
  const [market, setMarket] = useState(initialMarket)
  const [amount, setAmount] = useState('1.0')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedSide, setSelectedSide] = useState<'yes' | 'no' | null>(initialSide)

  const total = market.poolYes + market.poolNo
  const yesPct = total > 0 ? (market.poolYes / total) * 100 : 0
  const noPct = 100 - yesPct
  const side = selectedSide === 'yes' ? 'UP' : 'DOWN'

  const handleTrade = async () => {
    if (!address) return setMessage('❌ Connect your wallet first.')
    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) return setMessage('❌ Invalid amount.')
    if (!selectedSide) return setMessage('❌ Choose Yes or No.')

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
    <div className="trade-wrapper min-h-screen bg-white text-black font-[Montserrat] relative">
      <Head>
        <title>Market {market.id} | Tovo</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Drawer */}
      <WalletDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 fixed top-0 w-full bg-white dark:bg-[#0a0a0a] z-20">
        <Link href="/">
          <Image
            src="/logo.png"
            alt="Tovo"
            width={120}
            height={24}
            style={{ objectFit: 'contain' }}
          />
        </Link>
        <button
          onClick={() => setDrawerOpen((v) => !v)}
          className="wallet-toggle-btn"
        >
          <Image
            src="/connect wallet.svg"
            alt="Connect Wallet"
            width={120}
            height={24}
          />
        </button>
      </header>

      {/* Main */}
      <main className="px-4 py-4 max-w-md mx-auto mt-20">
        <div className="text-center mb-6">
          <h1 className="text-[#00B89F] uppercase text-sm font-semibold tracking-wide">
            Prediction Markets Today
          </h1>
        </div>

        <div className="bg-[#003E37] rounded-xl px-6 py-8 text-center space-y-4 text-white">
          <h2 className="text-xl font-semibold">{market.question}</h2>

          <p className="text-sm text-gray-300">
            Ends on{' '}
            {new Date(market.eventTime).toLocaleString('en-US', {
              month: 'numeric',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>

          {market.forecast != null && (
            <p className="text-sm text-gray-300">
              Forecast: {(market.forecast).toFixed(1)}%
            </p>
          )}

          <p className="text-sm font-medium text-gray-200">
            {market.forecast != null ? (
              <>
                {yesPct.toFixed(1)}% say it will be above{' '}
                {market.forecast.toFixed(1)}% — {noPct.toFixed(1)}% say it will be below
              </>
            ) : (
              <>
                {yesPct.toFixed(1)}% Yes — {noPct.toFixed(1)}% No
              </>
            )}
          </p>

          {/* Progress bar */}
          <div className="h-2 w-full bg-[#E5E5E5] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00B89F]"
              style={{ width: `${yesPct}%` }}
            />
          </div>

          {/* Yes / No Buttons */}
          <div className="flex justify-center gap-4 mt-4">
            <button
              onClick={() => {
                setAmount('1.0')
                setSelectedSide('yes')
              }}
              className={`w-24 py-2 border rounded-full font-medium transition ${
                selectedSide === 'yes'
                  ? 'bg-white text-black border-white'
                  : 'border-white text-white hover:bg-white hover:text-black'
              }`}
            >
              Yes
            </button>
            <button
              onClick={() => {
                setAmount('1.0')
                setSelectedSide('no')
              }}
              className={`w-24 py-2 border rounded-full font-medium transition ${
                selectedSide === 'no'
                  ? 'bg-white text-black border-white'
                  : 'border-white text-white hover:bg-white hover:text-black'
              }`}
            >
              No
            </button>
          </div>

          {/* Trade form */}
          <div className="mt-4 space-y-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-2 rounded-md border border-gray-300 text-sm text-black"
              placeholder="Enter amount"
            />
            <button
              onClick={handleTrade}
              disabled={loading}
              className="w-full bg-[#00B89F] text-white font-semibold py-2 rounded-md"
            >
              {loading ? 'Placing bet...' : 'Confirm Bet'}
            </button>
          </div>

          {message && <div className="text-sm mt-2">{message}</div>}
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
