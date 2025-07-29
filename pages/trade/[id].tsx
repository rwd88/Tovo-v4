// pages/trade/[id].tsx
import Image from 'next/image'
import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import type { Market } from '@prisma/client'

type Props = {
  market: Omit<Market, 'eventTime'> & { eventTime: string }
  initialSide: 'yes' | 'no'
}

export default function TradePage({ market, initialSide }: Props) {
  // local UI state for which button is active
  const [chosenSide, setChosenSide] = useState<'yes' | 'no'>(initialSide)

  // compute percentages
  const total = market.poolYes + market.poolNo
  const yesPct = total > 0 ? (market.poolYes / total) * 100 : 0

  return (
    <div className="min-h-screen bg-[#2C2F3A] text-white">
      {/* Header with logo */}
      <header className="flex items-center p-4 bg-[#15463D]">
        <Image src="/logo.png" alt="Tovo" width={32} height={32} />
        <h1 className="ml-2 font-bold text-xl">Tovo</h1>
      </header>

      <main className="px-4 py-8 max-w-md mx-auto">
        <div className="bg-[#15463D] rounded-2xl p-6 space-y-4">
          {/* Question */}
          <h2 className="text-2xl font-semibold">{market.question}</h2>

          {/* Expiry */}
          <p className="text-gray-300">
            Ends: {new Date(market.eventTime).toUTCString()}
          </p>

          {/* Progress bar */}
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

          {/* Yes / No buttons */}
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
        </div>
      </main>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const { id, side } = ctx.query
  // fetch market from your DB
  const { prisma } = await import('../../lib/prisma')
  const m = await prisma.market.findUnique({ where: { id: String(id) } })
  if (!m) {
    return { notFound: true }
  }

  // send Date as ISO string for hydration
  const market = {
    ...m,
    eventTime: m.eventTime.toISOString(),
  }

  const initialSide = side === 'no' ? 'no' : 'yes'
  return { props: { market, initialSide } }
}
