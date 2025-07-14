// pages/api/cron/settle-markets.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { sendCronSummary, sendAdminAlert } from '../../../lib/telegram'

export const config = {
  api: { bodyParser: false },
  // allow up to 60s for long‐running settlement
  maxDuration: 60,
}

interface SettleResponse {
  success: boolean
  totalSettled?: number
  totalProfit?: number
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SettleResponse>
) {
  // 1️⃣ Authenticate via ?secret= or Authorization: Bearer <secret>
  const secretFromQuery = (req.query.secret as string) || ''
  const authHeader = (req.headers.authorization || '').trim()
  const secretFromHeader =
    authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const incomingSecret = secretFromQuery || secretFromHeader

  if (incomingSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  try {
    console.log('⏳ Starting market settlement process...')
    const batchSize = 20
    let skip = 0
    let totalSettled = 0
    let totalProfit = 0
    let hasMore = true

    while (hasMore) {
      // 2️⃣ Fetch a page of markets ready to settle
      const markets = await prisma.market.findMany({
        where: {
          status: 'open',
          eventTime: { lt: new Date() },
          resolvedOutcome: { not: null },
        },
        include: { trades: true },
        orderBy: { eventTime: 'asc' },
        take: batchSize,
        skip,
      })

      if (markets.length === 0) {
        hasMore = false
        break
      }

      // 3️⃣ For each market, run all updates in one transaction
      for (const market of markets) {
        const outcome = market.resolvedOutcome!.toUpperCase()
        let houseCut = 0

        // a) If invalid outcome, just mark settled with zero profit
        if (!['YES', 'NO'].includes(outcome)) {
          await prisma.market.update({
            where: { id: market.id },
            data: { status: 'settled' },
          })
          totalSettled++
          continue
        }

        // b) Compute pool sizes, fees, profit share
        const yesPool = market.poolYes
        const noPool = market.poolNo
        const totalPool = yesPool + noPool
        const tradingFee   = totalPool * 0.01 * 2     // 1% each side
        houseCut           = totalPool * 0.10         // 10% house cut
        const distributable = totalPool - tradingFee - houseCut
        const winningPool   = outcome === 'YES' ? yesPool : noPool
        const shareFactor   = winningPool > 0 ? distributable / winningPool : 0

        // c) Build all updates: credit winners, mark trades, mark market
        const txs = []

        // credit each winning trade
        for (const t of market.trades) {
          if (t.type?.toUpperCase() === outcome) {
            const profit = t.amount * shareFactor - (t.fee ?? 0)
            txs.push(
              prisma.user.update({
                where: { id: t.userId },
                data: { balance: { increment: profit } },
              })
            )
          }
        }

        // mark _all_ trades settled
        txs.push(
          prisma.trade.updateMany({
            where: { marketId: market.id },
            data: { settled: true },
          })
        )

        // finally, mark market settled and record houseProfit
        txs.push(
          prisma.market.update({
            where: { id: market.id },
            data: { status: 'settled', houseProfit: houseCut },
          })
        )

        // d) Commit them atomically
        await prisma.$transaction(txs)

        totalSettled++
        totalProfit += houseCut
      }

      skip += batchSize
    }

    // 4️⃣ Send summary to your admin channel
    const nextRun = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const nextAt  = nextRun.toLocaleTimeString('en-US', { timeZone: 'UTC' })
    await sendCronSummary(
      `🏦 Settlement Complete\n` +
      `• Markets settled: ${totalSettled}\n` +
      `• House profit:   $${totalProfit.toFixed(2)}\n` +
      `⌛ Next: ${nextAt} UTC`
    )

    return res.status(200).json({
      success: true,
      totalSettled,
      totalProfit,
    })
  } catch (err: any) {
    console.error('❌ Settlement process failed:', err)
    const message = err instanceof Error ? err.message : String(err)
    await sendAdminAlert(`🚨 Settlement Failed: ${message}`)
    return res.status(500).json({ success: false, error: message })
  }
}
