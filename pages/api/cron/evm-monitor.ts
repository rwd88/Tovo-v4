// pages/api/cron/evm-monitor.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { startEvmDepositMonitor } from '../../../src/services/evmDepositMonitor'

/**
 * Make sure you’ve set either EVM_RPC_URL or ETH_RPC_URL in Vercel!
 */
const rpcUrl = process.env.EVM_RPC_URL || process.env.ETH_RPC_URL
if (!rpcUrl) {
  console.error('❌  Missing EVM RPC URL. Define EVM_RPC_URL (or ETH_RPC_URL) in your environment.')
}

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
    // this function should internally pick up process.env.EVM_RPC_URL
    await startEvmDepositMonitor()
    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('EVM monitor error:', err)
    return res.status(500).json({ success: false, error: err.message })
  } finally {
    isRunning = false
  }
}
