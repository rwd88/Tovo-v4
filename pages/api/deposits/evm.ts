// pages/api/deposits/evm.ts

import type { NextApiRequest, NextApiResponse } from 'next'
import { JsonRpcProvider }             from 'ethers'
import { prisma }                      from '../../../lib/prisma'

// Make sure you set an EVM_CHAIN_ID env var (e.g. "1" for mainnet)
const EVM_CHAIN_ID = parseInt(process.env.EVM_CHAIN_ID || '', 10)
if (!EVM_CHAIN_ID) {
  throw new Error('Missing or invalid EVM_CHAIN_ID in env')
}

const provider = new JsonRpcProvider(process.env.ETH_RPC!)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).end(`Method ${req.method} Not Allowed`)
  }

  try {
    // 1) Load all pending deposits for this chain
    const pending = await prisma.onChainDeposit.findMany({
      where:   { chainId: EVM_CHAIN_ID, status: 'pending' },
      select:  { id: true, txHash: true },
    })

    const approvedIds: number[] = []

    // 2) Check confirmations & approve
    for (const deposit of pending) {
      const receipt     = await provider.getTransactionReceipt(deposit.txHash)
      if (receipt?.blockNumber != null) {
        const currentBlk = await provider.getBlockNumber()
        if (currentBlk - receipt.blockNumber > 12) {
          await prisma.onChainDeposit.update({
            where: { id: deposit.id },
            data:  { status: 'approved' },
          })
          approvedIds.push(deposit.id)
        }
      }
    }

    // 3) Return a summary
    return res.status(200).json({
      success:  true,
      checked:  pending.length,
      approved: approvedIds.length,
      ids:      approvedIds,
    })
  } catch (err: any) {
    console.error('EVM monitor error:', err)
    return res.status(500).json({ error: 'Unable to process EVM deposits' })
  }
}
