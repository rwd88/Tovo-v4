import type { NextApiRequest, NextApiResponse } from 'next'
import { startEvmDepositMonitor }          from '../../../src/services/evmDepositMonitor'

let isRunning = false

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; message?: string; error?: string }>
) {
  if (isRunning) {
    return res.status(200).json({ success: true, message: 'Already running' })
  }
  isRunning = true

  try {
    const result = await startEvmDepositMonitor()
    return res.status(200).json({ success: true, result })
  } catch (err: any) {
    console.error('EVM monitor error:', err)
    return res.status(500).json({ success: false, error: err.message })
  } finally {
    isRunning = false
  }
}
