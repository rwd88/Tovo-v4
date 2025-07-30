// pages/index.tsx
'use client'

import Head from 'next/head'
import Image from 'next/image'
import { Geist, Geist_Mono } from 'next/font/google'
import styles from '../styles/Home.module.css'
import TradeForm from '../components/TradeForm'
import { useTokenBalance } from '../hooks/useTokenBalance'
import { useEffect, useState } from 'react'
import { useEthereum } from '../contexts/EthereumContext'
import { useSolana } from '../contexts/SolanaContext'
import { useTon } from '../contexts/TonContext'
import ConnectWalletButton from '../components/ConnectWalletButton'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

function getTimeRemainingText(eventTime: string): string {
  const now = new Date()
  const end = new Date(eventTime)
  const diff = end.getTime() - now.getTime()
  if (diff <= 0) return 'Expired'
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
  if (days > 0 && hours > 0)
    return `Ends in ${days} day${days > 1 ? 's' : ''} ${hours} hour${
      hours > 1 ? 's' : ''
    }`
  if (days > 0) return `Ends in ${days} day${days > 1 ? 's' : ''}`
  return `Ends in ${hours} hour${hours > 1 ? 's' : ''}`
}

export default function Home() {
  const { address: ethAddress } = useEthereum()
  const { publicKey: solAddress } = useSolana()
  const { address: tonAddress } = useTon()
  const [isClient, setIsClient] = useState(false)
  const [markets, setMarkets] = useState<any[]>([])
  
  // Use Ethereum address for balances by default
  const activeAddress = ethAddress || solAddress?.toString() || tonAddress

  useEffect(() => {
    setIsClient(true)
    fetch('/api/markets/active')
      .then((res) => res.json())
      .then((data) => setMarkets(data.markets || []))
      .catch(console.error)
  }, [])

  const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7'
  const USDC_ADDRESS = '0xA0b86991C6218B36c1d19D4a2e9Eb0cE3606EB48'
  const usdtBalance = isClient && ethAddress ? useTokenBalance(USDT_ADDRESS) : null
  const usdcBalance = isClient && ethAddress ? useTokenBalance(USDC_ADDRESS) : null

  if (!isClient) return null

  return (
    <>
      <Head>
        <title>Tovo Prediction Market</title>
        <meta name="description" content="Tovo prediction market dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={`${styles.page} ${geistSans.variable} ${geistMono.variable}`}>
        <main className={styles.main}>

          {/* Balances - Only show for Ethereum */}
          {ethAddress && (
            <div className="mb-6">
              <p>USDT Balance: {usdtBalance ?? 'Loading…'}</p>
              <p>USDC Balance: {usdcBalance ?? 'Loading…'}</p>
            </div>
          )}

          {/* Trade Form */}
          {activeAddress && (
            <div className="mb-8">
              <TradeForm />
            </div>
          )}

          {/* Active Markets */}
          <div className="w-full">
            <h2 className="text-2xl font-bold text-center mb-6 text-teal-500">
              PREDICTION MARKETS TODAY
            </h2>

            {markets.map((market, idx) => {
              const yes = market.poolYes ?? 0
              const no = market.poolNo ?? 0
              const yesPct = yes + no > 0 ? Math.round((yes / (yes + no)) * 100) : 50
              const noPct = 100 - yesPct

              return (
                <div
                  key={market.id ?? idx}
                  className="bg-[#00423b] text-white rounded-xl p-4 mb-5"
                >
                  <p className="text-lg font-semibold mb-1">{market.question}</p>
                  <p className="text-sm mb-3">
                    ⏳ {getTimeRemainingText(market.eventTime)}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(market.eventType?.split(',') || []).map((t: string, j: number) => (
                      <span
                        key={j}
                        className="bg-white text-black text-xs font-semibold px-3 py-1 rounded-full"
                      >
                        {t.trim()}
                      </span>
                    ))}
                  </div>

                  {/* Pools */}
                  <div className="space-y-2">
                    <div className="bg-teal-400 text-black font-semibold px-4 py-2 rounded-full">
                      Yes {yesPct}%
                    </div>
                    <div className="bg-white text-black font-semibold px-4 py-2 rounded-full">
                      No {noPct}%
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </main>

        <footer className={styles.footer}>
          <a href="https://nextjs.org" target="_blank" rel="noopener noreferrer">
            <Image src="/globe.svg" alt="Globe" width={16} height={16} />
            Go to nextjs.org →
          </a>
        </footer>
      </div>
    </>
  )
}