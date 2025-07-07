// pages/api/deposits/evm.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { JsonRpcProvider }             from 'ethers'
import { prisma }                      from '../../../lib/prisma'

// initialize your Ethereum JSON-RPC provider
const provider = new JsonRpcProvider(process.env.ETH_RPC!)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // only allow GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    // 1) load all pending Ethereum deposits from onChainDeposit
    const pending = await prisma.onChainDeposit.findMany({
      where:   { network: 'ethereum', status: 'pending' },
      select:  { id: true, txHash: true },
    })

    const approvedIds: number[] = []

    // 2) for each, check if it has >12 confirmations
    for (const d of pending) {
      const receipt = await provider.getTransactionReceipt(d.txHash)
      if (receipt?.blockNumber != null) {
        const current = await provider.getBlockNumber()
        if (current - receipt.blockNumber > 12) {
          await prisma.onChainDeposit.update({
            where: { id: d.id },
            data:  { status: 'approved' },
          })
          approvedIds.push(d.id)
        }
      }
    }

    // 3) return results
    return res.status(200).json({
      success:  true,
      checked:  pending.length,
      approved: approvedIds.length,
      ids:      approvedIds,
    })
  } catch (err: any) {
    console.error('EVM deposit monitor error:', err)
    return res.status(500).json({ error: 'Unable to process EVM deposits' })
  }
}
