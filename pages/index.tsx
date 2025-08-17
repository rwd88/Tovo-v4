'use client'

import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Geist, Geist_Mono } from 'next/font/google'
import styles from '../styles/Home.module.css'
import { useEffect, useMemo, useState } from 'react'
import { useEthereum } from '../contexts/EthereumContext'
import { useSolana } from '../contexts/SolanaContext'
import { useTon } from '../contexts/TonContext'

const WalletDrawer = dynamic(() => import('../components/WalletDrawer'), { ssr: false })

type Market = {
  id: string
  question: string
  eventTime: string
  poolYes: number
  poolNo: number
  tag: string | null
  status?: string | null
}

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export default function Home() {
  const { address: ethAddress } = useEthereum()
  const { publicKey: solAddress } = useSolana()
  const { address: tonAddress } = useTon()

  const [isClient, setIsClient] = useState(false)
  const [markets, setMarkets] = useState<Market[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState('All')

  useEffect(() => {
    setIsClient(true)
    ;(async () => {
      try {
        const res = await fetch('/api/markets', { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as Market[]
        setMarkets(Array.isArray(data) ? data : [])
      } catch (err: any) {
        console.error('Fetch markets failed:', err)
        setFetchError('Could not load markets. Please try again shortly.')
      }
    })()
  }, [])

  if (!isClient) return null

  const nowTs = Date.now()
  const safeMarkets = useMemo(() => {
    return (markets || [])
      .filter((m) => {
        const t = new Date(m.eventTime).getTime()
        return (
          (!m.status || m.status.toLowerCase() === 'open') &&
          !Number.isNaN(t) &&
          t > nowTs
        )
      })
      .sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime())
  }, [markets, nowTs])

  const tags = useMemo(() => {
    const set = new Set<string>()
    for (const m of safeMarkets) set.add(m.tag || 'General')
    return ['All', ...Array.from(set).sort()]
  }, [safeMarkets])

  const filtered =
    activeFilter === 'All'
      ? safeMarkets
      : safeMarkets.filter((m) => (m.tag || 'General') === activeFilter)

  const formatQuestion = (q: string) => {
    const t = q.trim()
    return /^Will\s/i.test(t) ? t : `Will ${t.replace(/\?$/, '')}?`
  }

  const yesPct = (m: Market) => {
    const yes = m.poolYes || 0
    const no = m.poolNo || 0
    const total = yes + no
    return total > 0 ? Math.round((yes / total) * 100) : 50
  }

  return (
    <>
      <Head>
        <title>Tovo Prediction Market</title>
        <meta name="description" content="Tovo prediction market dashboard" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <WalletDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className={`${styles.page} ${geistSans.variable} ${geistMono.variable}`}>
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4 fixed top-0 w-full bg-white dark:bg-[#0a0a0a] z-20">
          <Link href="/">
            <Image src="/logo.png" alt="Tovo" width={120} height={24} style={{ objectFit: 'contain' }} />
          </Link>
          <button className="wallet-toggle-btn" onClick={() => setDrawerOpen((v) => !v)}>
            <Image src="/connect wallet.svg" alt="Connect Wallet" width={120} height={24} />
          </button>
        </header>

        {/* Main */}
        <main className={`${styles.main} mt-20 px-4 w-full`}>
          <div className="text-center mb-6">
            <h1 className="text-[#00B89F] uppercase text-sm font-semibold tracking-wide">
              Prediction Markets Today
            </h1>
          </div>

          {/* Error / Empty states */}
          {fetchError && (
            <div className="rounded-md bg-red-50 p-3 text-red-800 mb-6">
              {fetchError}
            </div>
          )}

          {/* Filters */}
          {!fetchError && (
            <div className="filters">
              {tags.map((tag) => {
                const count =
                  tag === 'All'
                    ? safeMarkets.length
                    : safeMarkets.filter((m) => (m.tag || 'General') === tag).length
                return (
                  <button
                    key={tag}
                    className={`filter-button ${activeFilter === tag ? 'active' : ''}`}
                    onClick={() => setActiveFilter(tag)}
                  >
                    {tag} {count}
                  </button>
                )
              })}
            </div>
          )}

          {/* Market Cards */}
          {!fetchError && (
            <div className="market-list">
              {filtered.length === 0 ? (
                <div className="text-center opacity-75 py-6">
                  No active markets right now.
                </div>
              ) : (
                filtered.map((m) => (
                  <Link key={m.id} href={`/trade/${m.id}`} passHref>
                    <a className="market-card">
                      <div className="market-title">{formatQuestion(m.question)}</div>
                      <div className="market-time">
                        Ends On {new Date(m.eventTime).toLocaleDateString()},{' '}
                        {new Date(m.eventTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>

                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${yesPct(m)}%` }} />
                      </div>

                      <div className="button-group">
                        <button className="yes-button">Yes</button>
                        <button className="no-button">No</button>
                      </div>
                    </a>
                  </Link>
                ))
              )}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
