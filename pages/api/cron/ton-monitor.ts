// pages/api/cron/ton-monitor.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { startTonDepositMonitor }            from '../../../src/services/tonDepositMonitor'

let isRunning = false

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (isRunning) {
    return res.status(200).json({ success: true, message: 'Already running' })
  }
  isRunning = true

  try {
    await startTonDepositMonitor()
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('TON monitor error:', err)
    return res.status(500).json({ success: false, error: (err as Error).message })
  } finally {
    isRunning = false
  }
}
