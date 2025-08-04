'use client'

import Head from 'next/head'
import Image from 'next/image'
import { Geist, Geist_Mono } from 'next/font/google'
import styles from '../styles/Home.module.css'
import { useEffect, useState } from 'react'
import { useEthereum } from '../contexts/EthereumContext'
import { useSolana } from '../contexts/SolanaContext'
import { useTon } from '../contexts/TonContext'
import WalletDrawer from '../components/WalletDrawer'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

type Market = {
  id: string
  question: string
  eventTime: string
  poolYes: number
  poolNo: number
  tag: string | null
}

export default function Home() {
  const { address: ethAddress } = useEthereum()
  const { publicKey: solAddress } = useSolana()
  const { address: tonAddress } = useTon()
  const [isClient, setIsClient] = useState(false)
  const [markets, setMarkets] = useState<Market[]>([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState('All')

  // determine which wallet is connected (for balances, etc)
  const activeAddress = ethAddress || solAddress?.toString() || tonAddress

  useEffect(() => {
    setIsClient(true)
    fetch('/api/markets/active')
      .then((res) => res.json())
      .then((data: Market[]) => setMarkets(data))
      .catch(console.error)
  }, [])

  if (!isClient) return null

  // build filter list
  const tags = Array.from(
    new Set(markets.map((m) => m.tag || 'General'))
  ).sort()
  tags.unshift('All')

  const filtered = activeFilter === 'All'
    ? markets
    : markets.filter((m) => (m.tag || 'General') === activeFilter)

  function formatQuestion(q: string) {
    const t = q.trim()
    return /^Will\s/i.test(t) ? t : `Will ${t.replace(/\?$/, '')}?`
  }

  function pct(start: string, end: string) {
    const now = Date.now()
    const s = new Date(start).getTime()
    const e = new Date(end).getTime()
    return Math.max(0, Math.min(100, Math.round(((now - s) / (e - s)) * 100)))
  }

  return (
    <>
      <Head>
        <title>Tovo Prediction Market</title>
        <meta name="description" content="Tovo prediction market dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Drawer */}
      <WalletDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* page grid */}
      <div className={`${styles.page} ${geistSans.variable} ${geistMono.variable}`}>

        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4 w-full fixed top-0 bg-white dark:bg-[#0a0a0a] z-20">
          <Image src="/logo.png" alt="Tovo" width={120} height={24} />
          <button
            className="wallet-toggle-btn"
            onClick={() => setDrawerOpen((v) => !v)}
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
        <main className={`${styles.main} mt-20 px-4 w-full`}>

          {/* Heading */}
          <h1 className="text-2xl font-bold text-center mb-4 text-[#43E1C8]">
            PREDICTION MARKETS TODAY
          </h1>

          {/* Filters */}
          <div className="filters">
            {tags.map((tag) => {
              const count =
                tag === 'All'
                  ? markets.length
                  : markets.filter((m) => (m.tag || 'General') === tag).length
              return (
                <button
                  key={tag}
                  className={`filter-button ${
                    activeFilter === tag ? 'active' : ''
                  }`}
                  onClick={() => setActiveFilter(tag)}
                >
                  {tag} {count}
                </button>
              )
            })}
          </div>

          {/* Market Cards Grid */}
          <div className="market-list">
            {filtered.map((m) => {
              const progress = pct(m.eventTime, m.eventTime)
              const yes = m.poolYes || 0
              const no = m.poolNo || 0
              const yesPct = yes + no > 0 ? Math.round((yes / (yes + no)) * 100) : 50

              return (
                <div key={m.id} className="market-card">
                  <div className="market-title">{formatQuestion(m.question)}</div>
                  <div className="market-time">
                    Ends On {new Date(m.eventTime).toLocaleDateString()},{' '}
                    {new Date(m.eventTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>

                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${yesPct}%` }}
                    />
                  </div>

                  <div className="button-group">
                    <button className="yes-button">Yes</button>
                    <button className="no-button">No</button>
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