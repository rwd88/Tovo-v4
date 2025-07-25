import type { NextApiRequest, NextApiResponse } from 'next'
import { startTonDepositMonitor }    from '../../../src/services/tonDepositMonitor'
import { startEvmDepositMonitor }    from '../../../src/services/evmDepositMonitor'
import { startSolanaDepositMonitor } from '../../../src/services/solanaDepositMonitor'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; results?: any; error?: string }>
) {
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }

  // upfront check so you get a clear error if you forgot one
  const missing: string[] = []
  if (!process.env.TON_RPC_URL  || !process.env.TON_CHAIN_ID) missing.push('TON_RPC_URL/TON_CHAIN_ID')
  if (!process.env.EVM_RPC_URL)                       missing.push('EVM_RPC_URL')
  if (!process.env.BSC_RPC_URL)                       missing.push('BSC_RPC_URL')
  if (!process.env.SOLANA_RPC_URL)                    missing.push('SOLANA_RPC_URL')

  if (missing.length) {
    return res
      .status(500)
      .json({ success: false, error: `Missing env vars: ${missing.join(', ')}` })
  }

  try {
    const [ton, evm, solana] = await Promise.all([
      startTonDepositMonitor(),
      startEvmDepositMonitor(),
      startSolanaDepositMonitor(),
    ])
    return res.status(200).json({ success: true, results: { ton, evm, solana } })
  } catch (err: any) {
    console.error('daily-monitor error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
}
