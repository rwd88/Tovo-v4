// pages/trade/[id].tsx
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { prisma } from '../../lib/prisma'        // only if you want SSR/fetch in getServerSideProps
import { Market } from '@prisma/client'

type Props = {
  market: Market
  side: 'yes' | 'no'
}

export default function TradePage({ market: ssrMarket, side: ssrSide }: Props) {
  const router = useRouter()
  const { id, side: qsSide } = router.query

  // we can use SSR props or fetch client‐side; here's client‐side:
  const [market, setMarket] = useState<Market | null>(ssrMarket ?? null)
  const [chosenSide] = useState<'yes' | 'no'>(
    (qsSide === 'no' ? 'no' : 'yes')
  )

  useEffect(() => {
    if (!ssrMarket && id) {
      fetch(`/api/markets/${id}`)
        .then((r) => r.json())
        .then((data) => setMarket(data.market))
    }
  }, [id, ssrMarket])

  if (!market) return <div className="p-8 text-center">Loading…</div>

  // compute percentages
  const total = market.poolYes + market.poolNo
  const yesPct = total > 0 ? (market.poolYes / total) * 100 : 0

  return (
    <div className="min-h-screen bg-[#2C2F3A] text-white">
      {/* HEADER + LOGO */}
      <header className="flex items-center p-4 bg-[#15463D]">
        <Image
          src="/logo.png"          // put your logo file in public/logo.png
          alt="Tovo"
          width={32}
          height={32}
        />
        <h1 className="ml-2 font-bold text-xl">Tovo</h1>
      </header>

      <main className="px-4 py-8 max-w-md mx-auto">
        {/* QUESTION CARD */}
        <div className="bg-[#15463D] rounded-2xl p-6 space-y-4">
          <h2 className="text-2xl font-semibold">
            {market.question}
          </h2>

          <p className="text-gray-300">
            Ends {new Date(market.eventTime).toUTCString()}
          </p>

          {/* PROGRESS BAR */}
          <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-[#43E1C8]"
              style={{ width: `${yesPct}%` }}
            />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#43E1C8]">
              {yesPct.toFixed(1)}% Yes
            </span>
            <span className="text-pink-400">
              {(100 - yesPct).toFixed(1)}% No
            </span>
          </div>

          {/* BUTTONS */}
          <div className="flex space-x-4">
            <button
              onClick={() => router.push(`/trade/${id}?side=yes`)}
              className={`flex-1 py-2 rounded-full font-medium
                ${chosenSide === 'yes'
                  ? 'bg-[#43E1C8] text-[#15463D]'
                  : 'bg-gray-800 hover:bg-gray-700'}`}
            >
              Yes
            </button>
            <button
              onClick={() => router.push(`/trade/${id}?side=no`)}
              className={`flex-1 py-2 rounded-full font-medium
                ${chosenSide === 'no'
                  ? 'bg-[#43E1C8] text-[#15463D]'
                  : 'bg-gray-800 hover:bg-gray-700'}`}
            >
              No
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
