// pages/api/withdraw/execute.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import prisma from '../../../lib/prisma'
import { sendAdminAlert } from '../../../lib/telegram'
import { payToken, payHouse } from '../../../lib/payout'

type Resp =
  | { success: true; txUser?: string; txHouse?: string; net: number; fee: number }
  | { success: false; error: string }

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { nonce } = req.body || {}
    const n = String(nonce || '')
    if (!n) return res.status(400).json({ success: false, error: 'Missing nonce' })

    const WITHDRAW_FEE_BPS = Number(process.env.WITHDRAW_FEE_BPS ?? 100) // 1%

    const w = await prisma.withdrawal.findFirst({
      where: { nonce: n },
      select: { id: true, userId: true, amount: true, status: true, expiresAt: true },
    })
    if (!w) return res.status(404).json({ success: false, error: 'Withdrawal not found' })
    if (w.status !== 'pending') {
      return res.status(400).json({ success: false, error: `Already ${w.status}` })
    }
    if (w.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ success: false, error: 'Request expired' })
    }

    const fee = (w.amount * WITHDRAW_FEE_BPS) / 10_000
    const net = w.amount - fee
    if (net <= 0) return res.status(400).json({ success: false, error: 'Amount too small' })

    // Deduct balance & mark "processing"
    const { user } = await prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({
        where: { id: w.userId },
        select: { balance: true, walletAddress: true },
      })
      if (!u) throw new Error('User missing')
      if (u.balance < w.amount) throw new Error('Insufficient balance')

      await tx.user.update({
        where: { id: w.userId },
        data: { balance: { decrement: w.amount } },
      })

      await tx.withdrawal.update({
        where: { id: w.id },
        data: { status: 'processing' },
      })

      return { user: u }
    })

    // On-chain transfers
    let txUser: string | undefined
    let txHouse: string | undefined

    try {
      txUser = await payToken(user.walletAddress!, net)
    } catch (err: any) {
      // rollback on failure
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: w.userId },
          data: { balance: { increment: w.amount } },
        })
        await tx.withdrawal.update({
          where: { id: w.id },
          data: { status: 'failed' },
        })
      })
      throw new Error(`Payout failed: ${err.message}`)
    }

    try {
      if (fee > 0) txHouse = await payHouse(fee)
    } catch (err: any) {
      console.error('House fee transfer failed:', err)
      await sendAdminAlert(`House fee transfer failed on withdrawal ${w.id}: ${err.message}`)
    }

    await prisma.withdrawal.update({
      where: { id: w.id },
      data: { status: 'sent', txHash: txUser },
    })

    try {
      await sendAdminAlert?.(
        [
          '✅ Withdrawal executed',
          `• User: ${user.walletAddress?.slice(0, 6)}…${user.walletAddress?.slice(-4)}`,
          `• Gross: ${w.amount.toFixed(4)}  Fee: ${fee.toFixed(4)}  Net: ${net.toFixed(4)}`,
          txUser ? `• Tx user: ${txUser}` : null,
          txHouse ? `• Tx house: ${txHouse}` : null,
        ]
          .filter(Boolean)
          .join('\n')
      )
    } catch {}

    return res.status(200).json({ success: true, txUser, txHouse, net, fee })
  } catch (err: any) {
    console.error('[/api/withdraw/execute] error', err)
    return res.status(500).json({ success: false, error: err?.message || 'Server error' })
  }
}
