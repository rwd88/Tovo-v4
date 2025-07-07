// pages/api/cron/evm-monitor.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { startEvmDepositMonitor }            from '../../../src/services/evmDepositMonitor'

let isRunning = false

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (isRunning) {
    return res.status(200).json({ success: true, message: 'Already running' })
  }
  isRunning = true

  try {
    await startEvmDepositMonitor()
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('EVM monitor error:', err)
    return res.status(500).json({ success: false, error: (err as Error).message })
  } finally {
    isRunning = false
  }
}
