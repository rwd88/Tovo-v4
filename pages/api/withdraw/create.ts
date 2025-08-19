// pages/api/withdraw/create.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import { sendAdminAlert } from '../../../lib/telegram'
import { randomBytes } from 'crypto'

type Resp =
  | { success: true; id: string; nonce: string; amount: number; feeBps: number; expiresAt: string }
  | { success: false; error: string }

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { walletAddress, amount, chain = 'EVM' } = req.body || {}
    const addr = String(walletAddress || '').toLowerCase()
    const amt = Number(amount)

    if (!/^0x[a-f0-9]{40}$/.test(addr)) {
      return res.status(400).json({ success: false, error: 'Invalid walletAddress' })
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid amount' })
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress: addr },
      select: { id: true, balance: true },
    })
    if (!user) return res.status(404).json({ success: false, error: 'User not found' })
    if (user.balance < amt) {
      return res.status(400).json({ success: false, error: 'Insufficient balance' })
    }

    const WITHDRAW_FEE_BPS = Number(process.env.WITHDRAW_FEE_BPS ?? 100) // 1%
    const expiresAt = new Date(Date.now() + 15 * 60_000) // 15 minutes
    const nonce = randomBytes(16).toString('hex')

    const w = await prisma.withdrawal.create({
      data: {
        userId: user.id,
        chain,
        amount: amt,
        nonce,
        expiresAt,
        status: 'pending',
      },
      select: { id: true, nonce: true, amount: true, expiresAt: true },
    })

    try {
      await sendAdminAlert?.(
        [
          '🟡 Withdrawal request created',
          `• Wallet: ${addr.slice(0, 6)}…${addr.slice(-4)}`,
          `• Amount: ${amt}`,
          `• Fee: ${WITHDRAW_FEE_BPS / 100}%`,
          `• Expires: ${w.expiresAt.toISOString()}`,
          `• Nonce: ${w.nonce}`,
        ].join('\n')
      )
    } catch {}

    return res.status(200).json({
      success: true,
      id: w.id,
      nonce: w.nonce,
      amount: amt,
      feeBps: WITHDRAW_FEE_BPS,
      expiresAt: w.expiresAt.toISOString(),
    })
  } catch (err: any) {
    console.error('[/api/withdraw/create] error', err)
    return res.status(500).json({ success: false, error: err?.message || 'Server error' })
  }
}
