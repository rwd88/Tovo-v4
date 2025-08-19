// pages/trade/[id].tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import { ethers } from 'ethers'

type Market = {
  id: string
  question: string
  eventTime: string
  poolYes: number
  poolNo: number
  status?: string
}

type Side = 'YES' | 'NO'

const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 value) returns (bool)',
]

function formatDT(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function mask(addr = '') {
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
}

export default function TradePage() {
  const router = useRouter()
  const { id } = router.query

  const [market, setMarket] = useState<Market | null>(null)
  const [side, setSide] = useState<Side>('YES')
  const [amountStr, setAmountStr] = useState<string>('1')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>('')
  const [okMsg, setOkMsg] = useState<string>('')

  const FEE_BPS = useMemo(() => {
    const v = Number(process.env.NEXT_PUBLIC_FEE_BPS ?? 100)
    return Number.isFinite(v) ? v : 100
  }, [])

  const tokenAddress = (process.env.NEXT_PUBLIC_USDC_ADDRESS || '').trim()
  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 1)
  const house = (process.env.NEXT_PUBLIC_HOUSE || '').trim()

  // Load the market
  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      setError('')
      try {
        // Try a per-market endpoint, fallback to /api/markets/active
        const r1 = await fetch(`/api/markets/${id}`)
        if (r1.ok) {
          const data = (await r1.json()) as Market
          if (!cancelled) setMarket(data)
          return
        }
        const r2 = await fetch('/api/markets/active')
        const arr = (await r2.json()) as Market[]
        const m = arr.find((x) => x.id === id)
        if (!cancelled) setMarket(m ?? null)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load market')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const yesPct = useMemo(() => {
    if (!market) return 50
    const y = market.poolYes || 0
    const n = market.poolNo || 0
    const t = y + n
    return t > 0 ? Math.round((y / t) * 100) : 50
  }, [market])

  const amount = useMemo(() => {
    const n = Number(amountStr)
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [amountStr])

  const fee = useMemo(() => (amount * FEE_BPS) / 10_000, [amount, FEE_BPS])
  const total = useMemo(() => amount + fee, [amount, fee])

  async function ensureNetwork(ethereum: any, expected: number) {
    const hex = '0x' + expected.toString(16)
    const current = await ethereum.request({ method: 'eth_chainId' })
    if (current !== hex) {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hex }],
      })
    }
  }

  async function sendToken(totalToSend: number) {
    if (!tokenAddress) throw new Error('Token address not configured')
    if (!house) throw new Error('House wallet not configured')
    const anyWin = window as any
    const ethereum = anyWin?.ethereum
    if (!ethereum) throw new Error('No wallet found')

    await ensureNetwork(ethereum, chainId)

    const provider = new ethers.providers.Web3Provider(ethereum)
    await provider.send('eth_requestAccounts', [])
    const signer = provider.getSigner()

    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer)
    const decimals: number = await token.decimals()
    const units = ethers.utils.parseUnits(totalToSend.toString(), decimals)

    const tx = await token.transfer(house, units)
    const receipt = await tx.wait()
    return {
      txHash: receipt.transactionHash as string,
      wallet: (await signer.getAddress()) as string,
    }
  }

  async function confirmBet() {
    try {
      setBusy(true)
      setError('')
      setOkMsg('')

      if (!market) throw new Error('Market not found')
      if (!amount || amount <= 0) throw new Error('Enter a valid amount')
      if (!tokenAddress || !house) throw new Error('Missing client env (token/house)')

      // 1) On‑chain payment first
      const { txHash, wallet } = await sendToken(total)

      // 2) Tell backend to record trade & update pools
      const r = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketId: market.id,
          walletAddress: wallet,
          side,
          amount,
          clientFeeBps: FEE_BPS,
          txHash,
        }),
      })

      const j = await r.json()
      if (!r.ok || !j?.success) {
        throw new Error(j?.error || 'Failed to record trade')
      }

      setOkMsg(`Trade submitted • ${mask(wallet)} • tx ${mask(txHash)}`)
      // Update UI pools after response
      setMarket((prev) =>
        prev
          ? {
              ...prev,
              poolYes: j.newPoolYes ?? prev.poolYes,
              poolNo: j.newPoolNo ?? prev.poolNo,
            }
          : prev
      )
    } catch (e: any) {
      setError(e?.message || 'Failed to submit trade')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Head>
        <title>Tovo • Trade</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen flex flex-col items-center bg-white dark:bg-[#0a0a0a]">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-4 w-full max-w-md">
          <Link href="/" className="inline-flex items-center">
            <Image src="/logo.png" alt="Tovo" width={120} height={24} />
          </Link>
          <span className="text-sm text-gray-500">Connect Wallet</span>
        </header>

        {/* Card */}
        <main className="w-full max-w-md px-4">
          <div className="text-center mt-2 mb-4">
            <h1 className="text-[#00B89F] uppercase text-sm font-semibold tracking-wide">
              Prediction Markets Today
            </h1>
          </div>

          <div className="rounded-xl bg-[#0b4a45] text-white p-4 shadow-lg">
            {!market ? (
              <div className="text-center py-10">Loading…</div>
            ) : (
              <>
                <h2 className="font-semibold text-lg leading-snug">{market.question}</h2>
                <div className="text-xs text-[#a7f3d0] mt-1">
                  Ends on {formatDT(market.eventTime)}
                </div>

                <div className="mt-3 text-xs">
                  <span className="font-semibold">{yesPct}%</span> Yes —{' '}
                  <span className="font-semibold">{100 - yesPct}%</span> No
                </div>

                {/* YES/NO */}
                <div className="mt-3 flex gap-3">
                  <button
                    className={`flex-1 py-2 rounded-md ${
                      side === 'YES' ? 'bg-white text-[#0b4a45]' : 'bg-[#0f5b55]'
                    }`}
                    onClick={() => setSide('YES')}
                    disabled={busy}
                  >
                    Yes
                  </button>
                  <button
                    className={`flex-1 py-2 rounded-md ${
                      side === 'NO' ? 'bg-white text-[#0b4a45]' : 'bg-[#0f5b55]'
                    }`}
                    onClick={() => setSide('NO')}
                    disabled={busy}
                  >
                    No
                  </button>
                </div>

                {/* Amount */}
                <div className="mt-3 flex items-center gap-3">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    className="flex-1 rounded-md px-3 py-2 text-black"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    disabled={busy}
                  />
                  <button
                    onClick={confirmBet}
                    disabled={busy || !amount}
                    className="px-4 py-2 rounded-md bg-[#00B89F] text-black font-semibold disabled:opacity-50"
                  >
                    {busy ? 'Processing…' : 'CONFIRM BET'}
                  </button>
                </div>

                {/* Fee/Total helper */}
                <div className="mt-2 text-[11px] text-[#a7f3d0]">
                  Fee: {fee.toFixed(4)} • Total sent: {total.toFixed(4)}
                </div>

                {/* Alerts */}
                {error && (
                  <div className="mt-3 text-[12px] bg-red-100 text-red-700 px-3 py-2 rounded">
                    {error}
                  </div>
                )}
                {okMsg && (
                  <div className="mt-3 text-[12px] bg-emerald-100 text-emerald-800 px-3 py-2 rounded">
                    {okMsg}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="text-center mt-6">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
              ← Back to markets
            </Link>
          </div>
        </main>
      </div>
    </>
  )
}
