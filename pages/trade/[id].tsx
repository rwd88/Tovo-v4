'use client'

import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { GetServerSideProps, NextPage } from 'next'
import { BrowserProvider, Contract, formatEther, parseEther, parseUnits } from 'ethers'
import { RUNTIME } from '../../lib/runtimeConfig'

type Market = {
  id: string
  onchainId?: number | string | null
  question: string
  eventTime: string
  poolYes: number
  poolNo: number
  status: 'open' | 'closed' | 'settled'
  resolved?: boolean | null
  resolvedOutcome?: 'YES' | 'NO' | null
}

type Props = { market: Market; initialSide: 'yes' | 'no' }

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
]

const MARKET_ABI = [
  'function bet(uint256 marketId, uint8 side, uint256 amount) external',
  'function placeBet(uint256 marketId, bool side, uint256 amount) external',
  'function bet(uint256 marketId, uint8 side) payable',
  'function placeBet(uint256 marketId, bool side) payable',
]

// ---- Runtime config
const MARKET_ADDR = RUNTIME.MARKET
const USDC = RUNTIME.USDC // undefined in ETH mode
const CHAIN_ID = RUNTIME.CHAIN_ID
const CHAIN_HEX = '0x' + Number(CHAIN_ID).toString(16)
const FEE_BPS = Number(process.env.NEXT_PUBLIC_TRADE_FEE_BPS ?? 100) // 1%
const GAS_MARGIN = 1.25 // add 25% headroom to gas estimate

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

  const [connected, setConnected] = useState(false)
  const [chainOk, setChainOk] = useState<boolean>(false)
  const [walletChainId, setWalletChainId] = useState<number | null>(null)

  // detect wallet + chain changes
  useEffect(() => {
    const eth = (globalThis as any).ethereum
    if (!eth) return
    const handleConnect = async () => {
      try {
        const provider = new BrowserProvider(eth)
        const net = await provider.getNetwork()
        setWalletChainId(Number(net.chainId))
        setChainOk(Number(net.chainId) === CHAIN_ID)
        const accs = await eth.request({ method: 'eth_accounts' })
        setConnected(Array.isArray(accs) && accs.length > 0)
      } catch {}
    }
    handleConnect()
    const onChainChanged = (hexId: string) => {
      const id = parseInt(hexId, 16)
      setWalletChainId(id)
      setChainOk(id === CHAIN_ID)
    }
    const onAccountsChanged = (accs: string[]) => setConnected(accs.length > 0)
    eth.on?.('chainChanged', onChainChanged)
    eth.on?.('accountsChanged', onAccountsChanged)
    return () => {
      eth.removeListener?.('chainChanged', onChainChanged)
      eth.removeListener?.('accountsChanged', onAccountsChanged)
    }
  }, [])

  const isClosed = useMemo(() => new Date(market.eventTime).getTime() <= Date.now(), [market.eventTime])

  const yesPct = useMemo(() => {
    const y = Number(market.poolYes || 0)
    const n = Number(market.poolNo || 0)
    const t = y + n
    return t > 0 ? (y / t) * 100 : 50
  }, [market.poolYes, market.poolNo])
  const noPct = 100 - yesPct

  async function requireRightNetwork(): Promise<boolean> {
    const eth = (globalThis as any).ethereum
    if (!eth) {
      setMessage('❌ No wallet detected.')
      return false
    }
    const provider = new BrowserProvider(eth)
    const net = await provider.getNetwork()
    const onRight = Number(net.chainId) === CHAIN_ID
    if (onRight) return true

    // try to switch, then add if needed
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: CHAIN_HEX }] })
      setChainOk(true)
      return true
    } catch (e: any) {
      if (e?.code === 4902) {
        try {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: CHAIN_HEX,
              chainName: CHAIN_ID === 1 ? 'Ethereum Mainnet' : 'Sepolia Test Network',
              nativeCurrency: { name: CHAIN_ID === 1 ? 'ETH' : 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: [process.env.NEXT_PUBLIC_EVM_RPC_PUBLIC ?? 'https://rpc.sepolia.org'],
              blockExplorerUrls: [CHAIN_ID === 1 ? 'https://etherscan.io' : 'https://sepolia.etherscan.io'],
            }],
          })
          setChainOk(true)
          return true
        } catch {}
      }
      setMessage(`❌ Wrong network. Please switch to ${CHAIN_ID === 1 ? 'Ethereum Mainnet' : 'Sepolia Testnet'}.`)
      return false
    }
  }

  async function ensureApprove(signer: any, owner: string, spender: string, unitsNeeded: bigint, decimals = 6) {
    if (!USDC) return
    const usdc = new Contract(USDC, ERC20_ABI, signer)
    // always read decimals from chain just in case
    try { decimals = Number(await usdc.decimals()) } catch {}
    const allowance: bigint = await usdc.allowance(owner, spender)
    if (allowance >= unitsNeeded) return
    const tx = await usdc.approve(spender, unitsNeeded) // exact allowance, NOT max
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

      // ✅ Hard network guard (+ auto prompt)
      const ok = await requireRightNetwork()
      if (!ok) return

      const provider = new BrowserProvider(eth)
      const signer = await provider.getSigner()
      const from = await signer.getAddress()
      const marketContract = new Contract(MARKET_ADDR, MARKET_ABI, signer)
      const sideYesBool = side === 'YES'
      const sideYesUint = sideYesBool ? 1 : 2

      // ----- Preflight: balance + gas check -----
      if (!USDC) {
        const fee = (amt * FEE_BPS) / 10_000
        const totalEth = +(amt + fee).toFixed(6)
        const value = parseEther(totalEth.toString())

        const bal = await signer.getBalance()
        // estimate gas for the specific overload we’ll use
        let gasEstimate
        try {
          gasEstimate = await marketContract.estimateGas['bet(uint256,uint8)'](onchainId, sideYesUint, { value })
        } catch {
          gasEstimate = await marketContract.estimateGas['placeBet(uint256,bool)'](onchainId, sideYesBool, { value })
        }
        const feeData = await provider.getFeeData()
        const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n
        const gasCost = (gasEstimate * BigInt(Math.ceil(GAS_MARGIN * 100))) / 100n * gasPrice

        if (bal < value + gasCost) {
          const need = Number(formatEther(value + gasCost - bal))
          return setMessage(`❌ Insufficient balance. Need ~${need.toFixed(6)} ETH (value + gas).`)
        }
      }

      // ----- Execute trade -----
      let tx
      if (!USDC) {
        const fee = (amt * FEE_BPS) / 10_000
        const totalEth = +(amt + fee).toFixed(6)
        const value = parseEther(totalEth.toString())

        try {
          tx = await marketContract['bet(uint256,uint8)'](onchainId, sideYesUint, { value })
        } catch {
          tx = await marketContract['placeBet(uint256,bool)'](onchainId, sideYesBool, { value })
        }
      } else {
        // USDC mode
        const usdc = new Contract(USDC, ERC20_ABI, signer)
        let dec = 6
        try { dec = Number(await usdc.decimals()) } catch {}
        const fee = (amt * FEE_BPS) / 10_000
        const totalDebit = +(amt + fee).toFixed(dec)
        const units = parseUnits(totalDebit.toString(), dec)

        await ensureApprove(signer, from, MARKET_ADDR, units, dec)

        try {
          tx = await marketContract['bet(uint256,uint8,uint256)'](onchainId, sideYesUint, parseUnits(amt.toString(), dec))
        } catch {
          tx = await marketContract['placeBet(uint256,bool,uint256)'](onchainId, sideYesBool, parseUnits(amt.toString(), dec))
        }
      }

      const receipt = await tx.wait()
      if (!receipt || receipt.status !== 1) throw new Error('Transaction failed')

      setMessage('✅ Trade submitted!')
    } catch (err: any) {
      console.error(err)
      setMessage(`❌ ${err?.reason || err?.message || 'Something went wrong'}`)
    } finally {
      setLoading(false)
    }
  }

  // debug log (remove later)
  if (typeof window !== 'undefined') {
    console.log('CFG', { MARKET_ADDR, USDC, CHAIN_ID, onchainId: getOnchainId(market), walletChainId })
  }

  const wrongNet = walletChainId !== null && walletChainId !== CHAIN_ID

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

          {/* Network warning banner */}
          {wrongNet && (
            <div className="mt-3 mb-3 rounded bg-red-50 text-red-700 p-3 text-sm">
              ❌ Wrong network. Please switch to {CHAIN_ID === 1 ? 'Ethereum Mainnet' : 'Sepolia Testnet'}.
              <button
                onClick={requireRightNetwork}
                className="ml-3 px-2 py-1 rounded bg-red-600 text-white text-xs"
              >
                Switch Network
              </button>
            </div>
          )}

          <div className="bg-[#003E37] rounded-xl px-6 py-8 text-center space-y-4 text-white mt-4">
            <h2 className="text-xl font-semibold">{market.question || 'Market'}</h2>
            <p className="text-sm text-gray-300">
              Ends on {new Date(market.eventTime).toLocaleString(undefined, { hour12: true, month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </p>

            <p className="text-sm font-medium text-gray-200">{yesPct.toFixed(1)}% Yes — {noPct.toFixed(1)}% No</p>
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
                type="number" step="0.000001" min="0"
                className="w-full p-2 rounded-md border border-gray-300 text-sm text-black"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />

              {!MARKET_ADDR ? (
                <p className="text-red-300 text-sm">❌ Missing market config.</p>
              ) : USDC ? (
                <p className="text-xs text-gray-300">USDC mode: first trade may ask for Approve, then Trade.</p>
              ) : (
                <p className="text-xs text-gray-300">ETH mode: one transaction with value.</p>
              )}

              <button
                disabled={loading || !MARKET_ADDR || isClosed || !connected || wrongNet}
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
          poolYes: 1, poolNo: 1, status: 'open',
          resolved: false, resolvedOutcome: null,
        },
      },
    }
  }

  const market = (await res.json()) as Market
  return { props: { market, initialSide: side === 'no' ? 'no' : 'yes' } }
}
