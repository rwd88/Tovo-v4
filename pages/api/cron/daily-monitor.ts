// pages/api/cron/daily-monitor.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { startTonDepositMonitor }    from '../../../src/services/tonDepositMonitor'
import { startEvmDepositMonitor }    from '../../../src/services/evmDepositMonitor'
import { startSolanaDepositMonitor } from '../../../src/services/solanaDepositMonitor'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; results?: any; error?: string }>
) {
  // protect it with your CRON_SECRET
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  // make sure all your RPC env-vars are present
  const missing: string[] = []
  if (!process.env.TON_RPC_URL || !process.env.TON_CHAIN_ID)     missing.push('TON_RPC_URL/TON_CHAIN_ID')
  if (!process.env.EVM_RPC_URL && !process.env.ETH_RPC_URL)      missing.push('EVM_RPC_URL or ETH_RPC_URL')
  if (!process.env.SOLANA_RPC_URL && !process.env.NEXT_PUBLIC_SOLANA_RPC_URL) missing.push('SOLANA_RPC_URL')
  if (missing.length) {
    return res
      .status(500)
      .json({ success: false, error: `Missing environment variables: ${missing.join(', ')}` })
  }

  try {
    const results = {
      ton:    await startTonDepositMonitor(),
      evm:    await startEvmDepositMonitor(),
      solana: await startSolanaDepositMonitor(),
    }
    return res.status(200).json({ success: true, results })
  } catch (err: any) {
    console.error('daily-monitor error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
}
