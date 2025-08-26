// /pages/trade/[id].tsx
'use client'

import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { GetServerSideProps, NextPage } from 'next'
import { BrowserProvider, Contract, parseEther, parseUnits } from 'ethers'
import { RUNTIME } from '../../lib/runtimeConfig'

// ---- Types (align with your API/DB) ----
type Market = {
  id: string           // on-chain uint256 ID or mapped server ID
  question: string
  eventTime: string    // ISO
  poolYes: number
  poolNo: number
  status: 'open' | 'closed' | 'settled'
  resolved?: boolean | null
  resolvedOutcome?: 'YES' | 'NO' | null
}

type Props = {
  market: Market
  initialSide: 'yes' | 'no'
}

// ---- ABIs ----
const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
]

// Include both ETH & token overloads; we’ll call them by **full signature**
const MARKET_ABI = [
  // token (no value)
  'function bet(uint256 marketId, uint8 side, uint256 amount) external',
  'function placeBet(uint256 marketId, bool side, uint256 amount) external',
  // ETH (payable)
  'function bet(uint256 marketId, uint8 side) payable',
  'function placeBet(uint256 marketId, bool side) payable',
]

// ---- Runtime config from envs ----
const MARKET_ADDR = RUNTIME.MARKET
const USDC = RUNTIME.USDC // undefined in ETH mode
const CHAIN_ID = RUNTIME.CHAIN_ID
const FEE_BPS = Number(process.env.NEXT_PUBLIC_TRADE_FEE_BPS ?? 100) // 1%

const TradePage: NextPage<Props> = ({ market, initialSide }) => {
  const [side, setSide] = useState<'YES' | 'NO'>(initialSide === 'no' ? 'NO' : 'YES')
  const [amount, setAmount] = useState<string>('0.01')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const isClosed = useMemo(() => {
    try {
      return new Date(market.eventTime).getTime() <= Date.now()
    } catch {
      return false
    }
  }, [market.eventTime])

  const yesPct = useMemo(() => {
    const y = Number(market.poolYes || 0)
    const n = Number(market.poolNo || 0)
    const t = y + n
    return t > 0 ? (y / t) * 100 : 50
  }, [market.poolYes, market.poolNo])
  const noPct = 100 - yesPct

  async function ensureApprove(signer: any, owner: string, spender: string, unitsNeeded: bigint) {
    if (!USDC) return // ETH mode → no approvals
    const usdc = new Contract(USDC, ERC20_ABI, signer)
    const allowance: bigint = await usdc.allowance(owner, spender)
    if (allowance >= unitsNeeded) return
    const tx = await usdc.approve(spender, unitsNeeded)
    await tx.wait()
  }

  const handleTrade = async () => {
    setMessage(null)

    if (!MARKET_ADDR) return setMessage('❌ Missing market config.')
    if (isClosed) return setMessage('❌ Market already closed.')
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) return setMessage('❌ Enter a positive amount.')

    try {
      setLoading(true)

      const eth = (globalThis as any).ethereum
      if (!eth) throw new Error('No wallet detected')

      const provider = new BrowserProvider(eth)
      const signer = await provider.getSigner()

      // ensure correct chain
      const net = await provider.getNetwork()
      if (Number(net.chainId) !== CHAIN_ID) {
        throw new Error(`Wrong network. Please switch to chain ${CHAIN_ID}.`)
      }

      const from = await signer.getAddress()
      const marketContract = new Contract(MARKET_ADDR, MARKET_ABI, signer)
      const marketId = market.id
      const sideYesBool = side === 'YES'
      const sideYesUint = sideYesBool ? 1 : 2

      let tx

      if (!USDC) {
        // ---- ETH MODE (single payable tx) ----
        const fee = (amt * FEE_BPS) / 10_000
        const totalEth = +(amt + fee).toFixed(6)

        try {
          // bet(uint256,uint8) payable
          tx = await marketContract['bet(uint256,uint8)'](
            marketId,
            sideYesUint,
            { value: parseEther(totalEth.toString()) }
          )
        } catch {
          // placeBet(uint256,bool) payable
          tx = await marketContract['placeBet(uint256,bool)'](
            marketId,
            sideYesBool,
            { value: parseEther(totalEth.toString()) }
          )
        }
      } else {
        // ---- USDC MODE (approve → trade) ----
        const fee = (amt * FEE_BPS) / 10_000
        const totalDebit = +(amt + fee).toFixed(6)
        const units = parseUnits(totalDebit.toString(), 6) // USDC decimals = 6

        await ensureApprove(signer, from, MARKET_ADDR, units)

        try {
          // bet(uint256,uint8,uint256)
          tx = await marketContract['bet(uint256,uint8,uint256)'](
            marketId,
            sideYesUint,
            parseUnits(amt.toString(), 6)
          )
        } catch {
          // placeBet(uint256,bool,uint256)
          tx = await marketContract['placeBet(uint256,bool,uint256)'](
            marketId,
            sideYesBool,
            parseUnits(amt.toString(), 6)
          )
        }
      }

      const receipt = await tx.wait()
      if (!receipt || receipt.status !== 1) throw new Error('Transaction failed')

      // Fire-and-forget backend log (optional)
      try {
        await fetch('/api/trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marketId,
            walletAddress: from,
            amount: amt,
            side,
            txHash: tx.hash,
          }),
        })
      } catch {}

      setMessage('✅ Trade submitted!')
    } catch (err: any) {
      console.error(err)
      setMessage(`❌ ${err?.message || 'Something went wrong'}`)
    } finally {
      setLoading(false)
    }
  }

  // Temporary probe (remove after verifying)
  if (typeof window !== 'undefined') {
    console.log('CFG', { MARKET_ADDR, USDC, CHAIN_ID })
  }

  return (
    <>
      <Head>
        <title>Market {market.id} | Tovo</title>
        <meta name="theme-color" content="#ffffff" />
      </Head>

      <div className="trade-wrapper min-h-screen bg-white text-black font-[Montserrat] relative" id="trade-page">
        <header id="trade-header" className="flex items-center justify-between px-4 py-4 fixed top-0 w-full bg-white z-20">
          <Link href="/">
            <Image src="/logo.png" width={120} height={24} alt="Tovo" style={{ objectFit: 'contain' }} />
          </Link>
          <button className="wallet-toggle-btn">
            <Image src="/connect wallet.svg" alt="Connect Wallet" width={120} height={24} />
          </button>
        </header>

        <main id="trade-main" className="px-4 py-4 max-w-md mx-auto mt-20">
          <div id="trade-title" className="text-center mb-6">
            <h1 className="text-[#00B89F] uppercase text-sm font-semibold tracking-wide">Prediction Markets Today</h1>
          </div>

          <div id="trade-box" className="bg-[#003E37] rounded-xl px-6 py-8 text-center space-y-4 text-white">
            <h2 id="trade-question" className="text-xl font-semibold">{market.question || 'Market'}</h2>
            <p id="trade-endtime" className="text-sm text-gray-300">
              Ends on{' '}
              {new Date(market.eventTime).toLocaleString(undefined, {
                hour12: true, month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </p>

            <p id="trade-pools" className="text-sm font-medium text-gray-200">
              {yesPct.toFixed(1)}% Yes — {noPct.toFixed(1)}% No
            </p>

            <div id="trade-progress" className="h-2 w-full bg-[#E5E5E5] rounded-full overflow-hidden">
              <div className="h-full bg-[#00B89F]" style={{ width: `${yesPct}%` }} />
            </div>

            <div id="trade-buttons" className="flex justify-center gap-4 mt-4">
              <button
                className={`w-24 py-2 border rounded-full font-medium transition ${
                  side === 'YES' ? 'bg-white text-black border-white' : 'border-white text-white hover:bg-white hover:text-black'
                }`}
                onClick={() => setSide('YES')}
              >
                Yes
              </button>
              <button
                className={`w-24 py-2 border rounded-full font-medium transition ${
                  side === 'NO' ? 'bg-white text-black border-white' : 'border-white text-white hover:bg-white hover:text-black'
                }`}
                onClick={() => setSide('NO')}
              >
                No
              </button>
            </div>

            <div id="trade-form" className="mt-4 space-y-2">
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full p-2 rounded-md border border-gray-300 text-sm text-black"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />

              {!MARKET_ADDR ? (
                <p className="text-red-400 text-sm">❌ Missing market config.</p>
              ) : USDC ? (
                <p className="text-xs text-gray-300">USDC mode: first trade may ask for Approve, then Trade.</p>
              ) : (
                <p className="text-xs text-gray-300">ETH mode: one transaction with value.</p>
              )}

              <button
                disabled={loading || !MARKET_ADDR || isClosed}
                onClick={handleTrade}
                className="w-full bg-[#00B89F] text-white font-semibold py-2 rounded-md disabled:opacity-60"
              >
                {loading ? 'Submitting…' : 'Confirm Bet'}
              </button>

              {message && <p className="mt-2 text-sm">{message}</p>}
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

export default TradePage

// --- Keep your existing SSR fetch if you already have one ---
export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const id = ctx.params?.id as string
  const side = (ctx.query.side as string) || 'yes'

  const base = process.env.NEXT_PUBLIC_BASE_URL || `https://${ctx.req.headers.host}`
  const res = await fetch(`${base}/api/markets/${id}`).catch(() => null)

  if (!res || !res.ok) {
    const now = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    return {
      props: {
        initialSide: side === 'no' ? 'no' : 'yes',
        market: {
          id,
          question: 'Market',
          eventTime: now,
          poolYes: 1,
          poolNo: 1,
          status: 'open',
          resolved: false,
          resolvedOutcome: null,
        },
      },
    }
  }

  const market = (await res.json()) as Market
  return {
    props: {
      market,
      initialSide: side === 'no' ? 'no' : 'yes',
    },
  }
}
