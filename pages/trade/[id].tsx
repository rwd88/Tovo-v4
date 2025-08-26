'use client'

import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { GetServerSideProps, NextPage } from 'next'
import { BrowserProvider, Contract, parseEther, parseUnits } from 'ethers'
import { RUNTIME } from '../../lib/runtimeConfig'

type Market = {
  id: string                 // DB uuid
  onchainId?: number | string | null // ✅ numeric id expected by contract
  question: string
  eventTime: string
  poolYes: number
  poolNo: number
  status: 'open' | 'closed' | 'settled'
  resolved?: boolean | null
  resolvedOutcome?: 'YES' | 'NO' | null
}

type Props = { market: Market; initialSide: 'yes' | 'no' }

// ---- ABIs ----
const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
]
const MARKET_ABI = [
  // token
  'function bet(uint256 marketId, uint8 side, uint256 amount) external',
  'function placeBet(uint256 marketId, bool side, uint256 amount) external',
  // ETH
  'function bet(uint256 marketId, uint8 side) payable',
  'function placeBet(uint256 marketId, bool side) payable',
]

// ---- Runtime config ----
const MARKET_ADDR = RUNTIME.MARKET
const USDC = RUNTIME.USDC // undefined in ETH mode
const CHAIN_ID = RUNTIME.CHAIN_ID
const FEE_BPS = Number(process.env.NEXT_PUBLIC_TRADE_FEE_BPS ?? 100) // 1%

function getOnchainId(m: Market): bigint | null {
  const v = m.onchainId
  if (typeof v === 'number' && Number.isFinite(v)) return BigInt(v)
  if (typeof v === 'string' && /^\d+$/.test(v)) return BigInt(v)
  return null
}

const TradePage: NextPage<Props> = ({ market, initialSide }) => {
  const [side, setSide] = useState<'YES' | 'NO'>(initialSide === 'no' ? 'NO' : 'YES')
  const [amount, setAmount] = useState<string>('0.01')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const isClosed = useMemo(() => new Date(market.eventTime).getTime() <= Date.now(), [market.eventTime])

  const yesPct = useMemo(() => {
    const y = Number(market.poolYes || 0)
    const n = Number(market.poolNo || 0)
    const t = y + n
    return t > 0 ? (y / t) * 100 : 50
  }, [market.poolYes, market.poolNo])
  const noPct = 100 - yesPct

  async function ensureApprove(signer: any, owner: string, spender: string, unitsNeeded: bigint) {
    if (!USDC) return
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

    const onchainId = getOnchainId(market)
    if (onchainId === null) return setMessage('❌ Missing on-chain market id (numeric).')

    try {
      setLoading(true)

      const eth = (globalThis as any).ethereum
      if (!eth) throw new Error('No wallet detected')

      const provider = new BrowserProvider(eth)
      const signer = await provider.getSigner()
      const net = await provider.getNetwork()
      if (Number(net.chainId) !== CHAIN_ID) throw new Error(`Wrong network. Please switch to chain ${CHAIN_ID}.`)

      const from = await signer.getAddress()
      const marketContract = new Contract(MARKET_ADDR, MARKET_ABI, signer)
      const sideYesBool = side === 'YES'
      const sideYesUint = sideYesBool ? 1 : 2

      let tx
      if (!USDC) {
        // ETH mode
        const fee = (amt * FEE_BPS) / 10_000
        const totalEth = +(amt + fee).toFixed(6)

        try {
          tx = await marketContract['bet(uint256,uint8)'](onchainId, sideYesUint, {
            value: parseEther(totalEth.toString()),
          })
        } catch {
          tx = await marketContract['placeBet(uint256,bool)'](onchainId, sideYesBool, {
            value: parseEther(totalEth.toString()),
          })
        }
      } else {
        // USDC mode
        const fee = (amt * FEE_BPS) / 10_000
        const totalDebit = +(amt + fee).toFixed(6)
        const units = parseUnits(totalDebit.toString(), 6)

        await ensureApprove(signer, from, MARKET_ADDR, units)

        try {
          tx = await marketContract['bet(uint256,uint8,uint256)'](onchainId, sideYesUint, parseUnits(amt.toString(), 6))
        } catch {
          tx = await marketContract['placeBet(uint256,bool,uint256)'](onchainId, sideYesBool, parseUnits(amt.toString(), 6))
        }
      }

      const receipt = await tx.wait()
      if (!receipt || receipt.status !== 1) throw new Error('Transaction failed')

      // (optional) backend log
      try {
        await fetch('/api/trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marketId: market.id, // keep DB id for server
            walletAddress: from,
            amount: amt,
            side,
            txHash: (tx as any).hash,
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

  // remove after verify
  if (typeof window !== 'undefined') console.log('CFG', { MARKET_ADDR, USDC, CHAIN_ID, onchainId: getOnchainId(market) })

  return (
    <>
      <Head><title>Market {market.id} | Tovo</title></Head>
      <div className="min-h-screen bg-white text-black font-[Montserrat]">
        <header className="flex items-center justify-between px-4 py-4 fixed top-0 w-full bg-white z-20">
          <Link href="/"><Image src="/logo.png" width={120} height={24} alt="Tovo" style={{ objectFit: 'contain' }} /></Link>
          <button className="wallet-toggle-btn"><Image src="/connect wallet.svg" alt="Connect Wallet" width={120} height={24} /></button>
        </header>

        <main className="px-4 py-4 max-w-md mx-auto mt-20">
          <h1 className="text-[#00B89F] uppercase text-sm font-semibold tracking-wide text-center">Prediction Markets Today</h1>

          <div className="bg-[#003E37] rounded-xl px-6 py-8 text-center space-y-4 text-white mt-4">
            <h2 className="text-xl font-semibold">{market.question || 'Market'}</h2>
            <p className="text-sm text-gray-300">
              Ends on {new Date(market.eventTime).toLocaleString(undefined, { hour12: true, month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </p>
            <p className="text-sm font-medium text-gray-200">
              {yesPct.toFixed(1)}% Yes — {noPct.toFixed(1)}% No
            </p>

            <div className="flex justify-center gap-4 mt-4">
              <button
                className={`w-24 py-2 border rounded-full font-medium transition ${side === 'YES' ? 'bg-white text-black border-white' : 'border-white text-white hover:bg-white hover:text-black'}`}
                onClick={() => setSide('YES')}
              >Yes</button>
              <button
                className={`w-24 py-2 border rounded-full font-medium transition ${side === 'NO' ? 'bg-white text-black border-white' : 'border-white text-white hover:bg-white hover:text-black'}`}
                onClick={() => setSide('NO')}
              >No</button>
            </div>

            <div className="mt-4 space-y-2">
              <input
                type="number" step="0.01" min="0"
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
          id, onchainId: null,
          question: 'Market',
          eventTime: now,
          poolYes: 1, poolNo: 1,
          status: 'open', resolved: false, resolvedOutcome: null,
        },
      },
    }
  }

  const market = (await res.json()) as Market // must include onchainId
  return {
    props: {
      market,
      initialSide: side === 'no' ? 'no' : 'yes',
    },
  }
}
