'use client'

import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Geist, Geist_Mono } from 'next/font/google'
import styles from '../styles/Home.module.css'
import { useEffect, useMemo, useState } from 'react'

// Wallet contexts (these hooks should be SSR-safe already)
import { useEthereum } from '../contexts/EthereumContext'
import { useSolana } from '../contexts/SolanaContext'
import { useTon } from '../contexts/TonContext'

// Drawer is browser-only
const WalletDrawer = dynamic(() => import('../components/WalletDrawer'), { ssr: false })

type Market = {
  id: string
  question: string
  eventTime: string
  poolYes: number
  poolNo: number
  tag: string | null
}

type ApiShape =
  | Market[]
  | { markets?: Market[]; data?: Market[] } // common envelopes
  | null
  | undefined

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

// Normalize any API shape into an array
function toMarkets(x: ApiShape): Market[] {
  if (!x) return []
  if (Array.isArray(x)) return x
  if (Array.isArray((x as any).markets)) return (x as any).markets as Market[]
  if (Array.isArray((x as any).data)) return (x as any).data as Market[]
  return []
}

// Utilities
const formatQuestion = (q: string) => {
  const t = (q || '').trim()
  return /^Will\s/i.test(t) ? t : `Will ${t.replace(/\?$/, '')}?`
}
const yesPct = (m: Market) => {
  const yes = Number(m.poolYes || 0)
  const no = Number(m.poolNo || 0)
  const total = yes + no
  return total > 0 ? Math.round((yes / total) * 100) : 50
}

export default function Home() {
  // Contexts (not used here but initialized for headers/drawer etc.)
  const { /* address: ethAddress */ } = useEthereum() || {}
  const { /* publicKey: solAddress */ } = useSolana() || {}
  const { /* address: tonAddress */ } = useTon() || {}

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeFilter, setActiveFilter] = useState('All')
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/markets/active', { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as ApiShape
        const list = toMarkets(json)
        if (mounted) setMarkets(list)
      } catch (e: any) {
        console.error('Failed to fetch markets:', e)
        if (mounted) setError(e?.message || 'Failed to load markets')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  // Build tag list defensively
  const tags = useMemo(() => {
    const base = Array.isArray(markets) ? markets : []
    const set = new Set<string>(base.map((m) => (m?.tag ?? 'General')))
    return ['All', ...Array.from(set).sort()]
  }, [markets])

  const filtered = useMemo(() => {
    const base = Array.isArray(markets) ? markets : []
    if (activeFilter === 'All') return base
    return base.filter((m) => (m?.tag ?? 'General') === activeFilter)
  }, [markets, activeFilter])

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
          <Link href="/" className="inline-flex">
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

          {/* Filters */}
          <div className="filters">
            {(Array.isArray(tags) ? tags : []).map((tag) => {
              const count =
                tag === 'All'
                  ? (Array.isArray(markets) ? markets.length : 0)
                  : (Array.isArray(markets) ? markets : []).filter((m) => (m?.tag ?? 'General') === tag).length
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

          {/* States */}
          {loading && <p>Loading markets…</p>}
          {error && (
            <p className="text-red-600">
              Couldn&apos;t load markets: {error}
            </p>
          )}
          {!loading && !error && filtered.length === 0 && <p>No active markets.</p>}

          {/* Market Cards */}
          <div className="market-list">
            {(Array.isArray(filtered) ? filtered : []).map((m) => (
              <Link key={m.id} href={`/trade/${encodeURIComponent(m.id)}`} className="market-card">
                <div className="market-title">{formatQuestion(m.question)}</div>

                <div className="market-time">
                  Ends On{' '}
                  {new Date(m.eventTime).toLocaleDateString()},{' '}
                  {new Date(m.eventTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>

                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${yesPct(m)}%` }} />
                </div>

                <div className="button-group">
                  <button className="yes-button" type="button">Yes</button>
                  <button className="no-button" type="button">No</button>
                </div>
              </Link>
            ))}
          </div>
        </main>
      </div>
    </>
  )
}
