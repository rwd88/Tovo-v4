// pages/api/cron/daily-monitor.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { startTonDepositMonitor }    from '../../../src/services/tonDepositMonitor'
import { startEvmDepositMonitor }    from '../../../src/services/evmDepositMonitor'
import { startSolanaDepositMonitor } from '../../../src/services/solanaDepositMonitor'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // optional: verify a shared secret so nobody can call this publicly
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const results: Record<string, any> = {}

  try {
    results.ton    = await startTonDepositMonitor()    // make sure these return summaries
    results.evm    = await startEvmDepositMonitor()
    results.solana = await startSolanaDepositMonitor()

    return res.status(200).json({ success: true, results })
  } catch (err: any) {
    console.error('daily-monitor error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
}
