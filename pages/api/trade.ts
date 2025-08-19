// pages/api/trade.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../lib/prisma'
import { sendAdminAlert } from '../../lib/telegram'
import { ethers } from 'ethers'

type TradeSide = 'YES' | 'NO'

interface TradeResponse {
  success: boolean
  newPoolYes?: number
  newPoolNo?: number
  error?: string
}

const ERC20_IFACE = new ethers.utils.Interface([
  "event Transfer(address indexed from, address indexed to, uint256 value)"
])

function bad(res: NextApiResponse<TradeResponse>, msg: string, code = 400) {
  return res.status(code).json({ success: false, error: msg })
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
    const marketId = String(body?.marketId || '').trim()
    const walletAddress = String(body?.walletAddress || '').trim().toLowerCase()
    const side = String(body?.side || '').toUpperCase() as TradeSide
    const amount = Number(body?.amount)
    const clientFeeBps = Number(body?.clientFeeBps ?? 100)
    const txHash = String(body?.txHash || '').trim()

    if (!marketId) return bad(res, 'Missing marketId')
    if (!/^0x[a-f0-9]{40}$/.test(walletAddress)) return bad(res, 'Invalid walletAddress')
    if (side !== 'YES' && side !== 'NO') return bad(res, 'Side must be YES or NO')
    if (!Number.isFinite(amount) || amount <= 0) return bad(res, 'Amount must be a positive number')
    if (!/^0x([A-Fa-f0-9]{64})$/.test(txHash)) return bad(res, 'Missing or invalid txHash')

    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: { id: true, question: true, status: true, eventTime: true, resolvedOutcome: true },
    })
    if (!market) return bad(res, 'Market not found', 404)
    if (market.status.toLowerCase() !== 'open') return bad(res, 'Market is not open')
    if (market.resolvedOutcome) return bad(res, 'Market already resolved')
    if (new Date(market.eventTime).getTime() <= Date.now()) return bad(res, 'Market already closed')

    // --- verify on-chain payment ---
    const provider = new ethers.providers.JsonRpcProvider(process.env.EVM_RPC_URL!)
    const receipt = await provider.getTransactionReceipt(txHash)
    if (!receipt || receipt.status !== 1) return bad(res, 'Payment tx not found or failed', 402)

    const TOKEN = (process.env.USDC_MAINNET || '').toLowerCase()
    const HOUSE = (process.env.HOUSE_WALLET_ADDRESS || '').toLowerCase()
    if (!TOKEN || !HOUSE) return bad(res, 'Server token/house not configured', 500)

    const tokenLogs = receipt.logs.filter(l => l.address.toLowerCase() === TOKEN)
    let paid = ethers.BigNumber.from(0)
    for (const log of tokenLogs) {
      try {
        const parsed = ERC20_IFACE.parseLog(log)
        if (parsed.name === 'Transfer') {
          const from = parsed.args.from.toLowerCase()
          const to = parsed.args.to.toLowerCase()
          if (from === walletAddress && to === HOUSE) {
            paid = paid.add(parsed.args.value)
          }
        }
      } catch {}
    }
    if (paid.isZero()) return bad(res, 'No valid USDC transfer to house found in tx', 402)

    // decimals assumed 6 for USDC/USDT
    const decimals = 6
    const paidHuman = Number(ethers.utils.formatUnits(paid, decimals))
    const fee = (amount * clientFeeBps) / 10_000
    const total = amount + fee
    if (paidHuman + 1e-9 < total) return bad(res, 'Paid amount is less than required', 402)

    // --- record trade & update pools atomically ---
    const result = await prisma.$transaction(async (tx) => {
      // Ensure user exists (no balance check anymore)
      const user = await tx.user.upsert({
        where: { walletAddress },
        update: {},
        create: { walletAddress, balance: 0 },
        select: { id: true },
      })

      const updatedMarket = await tx.market.update({
        where: { id: marketId },
        data:
          side === 'YES'
            ? { poolYes: { increment: amount }, feeCollected: { increment: fee } }
            : { poolNo: { increment: amount },  feeCollected: { increment: fee } },
        select: { poolYes: true, poolNo: true },
      })

      await tx.trade.create({
        data: {
          marketId,
          userId: user.id,
          type: side,
          amount,
          fee,
          settled: false,
          // you can add tx hash column later if desired
        },
      })

      return {
        newPoolYes: updatedMarket.poolYes,
        newPoolNo:  updatedMarket.poolNo,
      }
    })

    // admin alert (non-blocking)
    try {
      await sendAdminAlert?.(
        [
          '🟢 New Trade (on-chain paid)',
          `• Market: ${market.id}`,
          market.question ? `• Q: ${market.question}` : null,
          `• Wallet: ${walletAddress.slice(0,6)}…${walletAddress.slice(-4)}`,
          `• Side: ${side}`,
          `• Amount: ${amount.toFixed(2)}  Fee: ${fee.toFixed(2)}  Total: ${total.toFixed(2)}`,
          `• Tx: ${txHash}`,
        ].filter(Boolean).join('\n')
      )
    } catch {}

    return res.status(200).json({ success: true, ...result })
  } catch (err: any) {
    console.error('[/api/trade] failed:', err)
    return bad(res, err?.message || 'Server error', 500)
  }
}
