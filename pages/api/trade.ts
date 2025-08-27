// pages/api/trade.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../lib/prisma'
import { sendAdminAlert } from '../../lib/telegram'
import {
  JsonRpcProvider,
  getAddress,
  isAddress,
} from 'ethers'

export const runtime = 'nodejs'

type TradeSide = 'YES' | 'NO'
interface TradeResponse {
  success: boolean
  newPoolYes?: number
  newPoolNo?: number
  error?: string
}

const REQUIRED_CHAIN_ID =
  Number(process.env.NEXT_PUBLIC_ETH_CHAIN_ID || process.env.ETH_CHAIN_ID || 0)

const MARKET_ADDR =
  process.env.NEXT_PUBLIC_MARKET_ADDRESS?.toLowerCase() ||
  process.env.MARKET_ADDRESS?.toLowerCase() ||
  ''

const RPC_URL = process.env.EVM_RPC_URL || ''

const mask = (addr = '') => (addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr)
const bad = (res: NextApiResponse<TradeResponse>, msg: string, code = 400) =>
  res.status(code).json({ success: false, error: msg })

/** Lightweight on-chain verification using RPC (no ABI required) */
async function verifyTxOnChain({
  txHash,
  walletAddress,
}: {
  txHash: string
  walletAddress: string
}) {
  if (!RPC_URL) throw new Error('Server misconfigured: EVM_RPC_URL missing')
  if (!REQUIRED_CHAIN_ID) throw new Error('Server misconfigured: ETH_CHAIN_ID missing')
  if (!MARKET_ADDR) throw new Error('Server misconfigured: MARKET_ADDRESS missing')

  const provider = new JsonRpcProvider(RPC_URL)
  const net = await provider.getNetwork()
  if (Number(net.chainId) !== REQUIRED_CHAIN_ID) {
    throw new Error(`Wrong RPC network. Expected chain ${REQUIRED_CHAIN_ID}, got ${net.chainId}`)
  }

  // Ensure there is contract code at MARKET_ADDR on this network
  const code = await provider.getCode(MARKET_ADDR)
  if (!code || code === '0x') {
    throw new Error('Invalid MARKET_ADDRESS on this network (no contract bytecode)')
  }

  const receipt = await provider.getTransactionReceipt(txHash)
  if (!receipt) throw new Error('Transaction not found')
  if (receipt.status !== 1) throw new Error('Transaction not confirmed (status != 1)')

  // From/to checks (normalize casing)
  const tx = await provider.getTransaction(txHash)
  if (!tx) throw new Error('Transaction details not found')

  const fromNorm = getAddress(tx.from).toLowerCase()
  const toNorm = (tx.to ? getAddress(tx.to) : '').toLowerCase()

  if (fromNorm !== getAddress(walletAddress).toLowerCase()) {
    throw new Error('Sender address does not match walletAddress')
  }
  if (toNorm !== MARKET_ADDR) {
    throw new Error('Transaction not sent to the market contract')
  }

  // If you want to be stricter: you could parse logs here with the contract ABI
  // and confirm a BetPlaced(...) event with expected fields.

  return { ok: true }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TradeResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return bad(res, 'Only POST allowed', 405)
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const marketId = String(body?.marketId || '').trim()                  // DB UUID
    const walletAddressRaw = String(body?.walletAddress || '').trim()
    const side = String(body?.side || '').toUpperCase() as TradeSide
    const amount = Number(body?.amount)
    const txHash = body?.txHash ? String(body.txHash).trim() : undefined  // optional but recommended

    // ---- Basic validation
    if (!marketId) return bad(res, 'Missing marketId')
    if (!walletAddressRaw) return bad(res, 'Missing walletAddress')
    if (!isAddress(walletAddressRaw)) return bad(res, 'Invalid walletAddress format')
    if (side !== 'YES' && side !== 'NO') return bad(res, 'Side must be YES or NO')
    if (!Number.isFinite(amount) || amount <= 0) return bad(res, 'Amount must be positive')

    // ---- Validate market + status/time
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: {
        id: true,
        question: true,
        status: true,
        eventTime: true,
        resolvedOutcome: true,
        poolYes: true,
        poolNo: true,
      },
    })
    if (!market) return bad(res, 'Market not found', 404)
    if (market.status.toLowerCase() !== 'open') return bad(res, 'Market is not open')
    if (market.resolvedOutcome) return bad(res, 'Market already resolved')
    if (new Date(market.eventTime).getTime() <= Date.now()) return bad(res, 'Market already closed')

    // ---- Server-side network & contract check even if no txHash (defense-in-depth)
    if (!RPC_URL || !REQUIRED_CHAIN_ID || !MARKET_ADDR) {
      return bad(res, 'Server configuration incomplete (RPC/CHAIN/ADDRESS)')
    }
    const provider = new JsonRpcProvider(RPC_URL)
    const net = await provider.getNetwork()
    if (Number(net.chainId) !== REQUIRED_CHAIN_ID) {
      return bad(res, `Server RPC on wrong chain. Expected ${REQUIRED_CHAIN_ID}, got ${net.chainId}`)
    }
    const code = await provider.getCode(MARKET_ADDR)
    if (!code || code === '0x') {
      return bad(res, 'Market contract not deployed on the configured chain')
    }

    // ---- If a txHash is provided, verify it on-chain
    if (txHash) {
      try {
        await verifyTxOnChain({ txHash, walletAddress: walletAddressRaw })
      } catch (e: any) {
        return bad(res, `On-chain verification failed: ${e?.message || 'unknown error'}`)
      }
    }

    // ---- Upsert user
    const user = await prisma.user.upsert({
      where: { walletAddress: walletAddressRaw.toLowerCase() },
      update: {},
      create: { walletAddress: walletAddressRaw.toLowerCase(), balance: 0 },
      select: { id: true },
    })

    // ---- Update pools locally (UI convenience; chain is source of truth)
    const updated = await prisma.market.update({
      where: { id: marketId },
      data:
        side === 'YES'
          ? { poolYes: { increment: amount } }
          : { poolNo: { increment: amount } },
      select: { poolYes: true, poolNo: true, question: true },
    })

    // ---- Record trade row (txHash optional—add column if you want to persist it)
    await prisma.trade.create({
      data: {
        marketId,
        userId: user.id,
        type: side,
        amount,
        fee: 0,
        settled: false,
        // txHash, // uncomment if your Trade model has a txHash column
      },
    })

    // ---- Admin alert (non-blocking)
    try {
      await sendAdminAlert?.(
        [
          '🟢 New Trade (server-verified)',
          `• Market: ${market.id}`,
          updated.question ? `• Q: ${updated.question}` : null,
          `• Wallet: ${mask(walletAddressRaw)}`,
          `• Side: ${side}`,
          `• Amount: ${amount.toFixed(6)} ${process.env.NEXT_PUBLIC_USDC_ADDRESS ? 'USDC' : 'ETH'}`,
          txHash ? `• Tx: ${txHash.slice(0, 10)}…` : null,
          `• Pools → Yes: ${updated.poolYes.toFixed(6)} | No: ${updated.poolNo.toFixed(6)}`,
          `• When: ${new Date().toISOString()}`,
        ]
          .filter(Boolean)
          .join('\n')
      )
    } catch {}

    return res
      .status(200)
      .json({ success: true, newPoolYes: updated.poolYes, newPoolNo: updated.poolNo })
  } catch (err: any) {
    console.error('[/api/trade] failed:', err)
    return bad(res, err?.message || 'Server error', 500)
  }
}
