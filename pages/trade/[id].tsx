'use client'

import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import type { Market } from '@prisma/client'
import { useEthereum } from '../../contexts/EthereumContext'
import dynamic from 'next/dynamic'
import { BrowserProvider, Contract, parseUnits } from 'ethers'

const WalletDrawer = dynamic(() => import('../../components/WalletDrawer'), { ssr: false })

type Props = {
  market: Omit<Market, 'eventTime'> & { eventTime: string }
  initialSide: 'yes' | 'no'
}

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
]
const MARKET_ABI = [
  // common variants – we’ll try in order
  'function bet(uint256 marketId, uint8 side, uint256 amount) external',
  'function placeBet(uint256 marketId, bool side, uint256 amount) external',
]

const USDC = process.env.NEXT_PUBLIC_USDC_ADDRESS || ''
const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || ''
const FEE_BPS = Number(process.env.NEXT_PUBLIC_TRADE_FEE_BPS ?? 100) // 1%

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

  const apiSide: 'YES' | 'NO' | null =
    selectedSide === 'yes' ? 'YES' : selectedSide === 'no' ? 'NO' : null

  async function ensureApprove(signer: any, owner: string, spender: string, unitsNeeded: bigint) {
    const usdc = new Contract(USDC, ERC20_ABI, signer)
    // USDC is 6 decimals; parseUnits already used with 6
    const allowance: bigint = await usdc.allowance(owner, spender)
    if (allowance >= unitsNeeded) return
    const tx = await usdc.approve(spender, unitsNeeded)
    await tx.wait()
  }

  const handleTrade = async () => {
    setMessage(null)

    if (!address) return setMessage('❌ Connect your wallet first.')
    if (!apiSide) return setMessage('❌ Choose Yes or No.')
    if (!USDC || !MARKET_ADDR) return setMessage('❌ Missing token/market config.')
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) return setMessage('❌ Enter a positive amount.')
    if (new Date(market.eventTime).getTime() <= Date.now()) {
      return setMessage('❌ Market already closed.')
    }

    try {
      setLoading(true)

      // 1) Connect wallet
      if (!(globalThis as any).ethereum) throw new Error('No wallet detected')
      const provider = new BrowserProvider((globalThis as any).ethereum)
      const signer = await provider.getSigner()
      const from = await signer.getAddress()

      // 2) Compute trade + fee and approve token
      const fee = (amt * FEE_BPS) / 10_000
      const totalDebit = +(amt + fee).toFixed(6)
      const units = parseUnits(totalDebit.toString(), 6) // USDC 6 decimals
      await ensureApprove(signer, from, MARKET_ADDR, units)

      // 3) Call market contract (try both bet() and placeBet())
      const marketContract = new Contract(MARKET_ADDR, MARKET_ABI, signer)
      const marketId = market.id
      const sideYesBool = apiSide === 'YES'
      const sideYesUint = sideYesBool ? 1 : 2 // assuming 1=Yes, 2=No for bet(uint8)

      let tx
      try {
        // try bet(uint256,uint8,uint256)
        tx = await marketContract.bet(marketId, sideYesUint, parseUnits(amt.toString(), 6))
      } catch {
        // fallback to placeBet(uint256,bool,uint256)
        tx = await marketContract.placeBet(marketId, sideYesBool, parseUnits(amt.toString(), 6))
      }
      const receipt = await tx.wait()
      if (!receipt || receipt.status !== 1) throw new Error('Transaction failed')

      // 4) Optional: tell backend to log (non-blocking)
      try {
        await fetch('/api/trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marketId,
            walletAddress: from,
            amount: amt,
            side: apiSide,
            txHash: tx.hash,
          }),
        })
      } catch {}

      setMessage('✅ Trade submitted on-chain!')
    } catch (err: any) {
      console.error(err)
      setMessage(`❌ ${err?.message || 'Server error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="trade-wrapper min-h-screen bg-white text-black font-[Montserrat] relative" id="trade-page">
      <Head>
        <title>Market {market.id} | Tovo</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Wallet Drawer */}
      <WalletDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Header */}
      <header id="trade-header" className="flex items-center justify-between px-4 py-4 fixed top-0 w-full bg-white dark:bg-[#0a0a0a] z-20">
        <Link href="/">
          <Image src="/logo.png" alt="Tovo" width={120} height={24} style={{ objectFit: 'contain' }} />
        </Link>
        <button onClick={() => setDrawerOpen((v) => !v)} className="wallet-toggle-btn">
          <Image src="/connect wallet.svg" alt="Connect Wallet" width={120} height={24} />
        </button>
      </header>

      {/* Main */}
      <main id="trade-main" className="px-4 py-4 max-w-md mx-auto mt-20">
        <div id="trade-title" className="text-center mb-6">
          <h1 className="text-[#00B89F] uppercase text-sm font-semibold tracking-wide">
            Prediction Markets Today
          </h1>
        </div>

        <div id="trade-box" className="bg-[#003E37] rounded-xl px-6 py-8 text-center space-y-4 text-white">
          <h2 id="trade-question" className="text-xl font-semibold">{market.question}</h2>

          <p id="trade-endtime" className="text-sm text-gray-300">
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
            <p id="trade-forecast" className="text-sm text-gray-300">
              Forecast: {market.forecast.toFixed(1)}%
            </p>
          )}

          <p id="trade-pools" className="text-sm font-medium text-gray-200">
            {market.forecast != null ? (
              <>
                {yesPct.toFixed(1)}% say it will be above {market.forecast.toFixed(1)}% —{' '}
                {noPct.toFixed(1)}% say it will be below
              </>
            ) : (
              <>
                {yesPct.toFixed(1)}% Yes — {noPct.toFixed(1)}% No
              </>
            )}
          </p>

          {/* Progress bar */}
          <div id="trade-progress" className="h-2 w-full bg-[#E5E5E5] rounded-full overflow-hidden">
            <div className="h-full bg-[#00B89F]" style={{ width: `${yesPct}%` }} />
          </div>

          {/* Yes / No buttons */}
          <div id="trade-buttons" className="flex justify-center gap-4 mt-4">
            <button
              onClick={() => { setAmount('1.0'); setSelectedSide('yes') }}
              className={`w-24 py-2 border rounded-full font-medium transition ${
                selectedSide === 'yes'
                  ? 'bg-white text-black border-white'
                  : 'border-white text-white hover:bg-white hover:text-black'
              }`}
            >
              Yes
            </button>
            <button
              onClick={() => { setAmount('1.0'); setSelectedSide('no') }}
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
          <div id="trade-form" className="mt-4 space-y-2">
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

          {message && <div id="trade-message" className="text-sm mt-2">{message}</div>}
        </div>
      </main>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const { id, side } = ctx.query
const prisma = (await import('../../lib/prisma')).default 
  const m = await prisma.market.findUnique({ where: { id: String(id) } })
  if (!m) return { notFound: true }

  return {
    props: {
      market: { ...m, eventTime: m.eventTime.toISOString() },
      initialSide: side === 'no' ? 'no' : 'yes',
    },
  }
}
