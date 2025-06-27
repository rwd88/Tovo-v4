// pages/api/deposits/evm.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { JsonRpcProvider }             from 'ethers'
 import { prisma }                      from '../../../lib/prisma'

// v6 style:
const provider = new JsonRpcProvider(process.env.ETH_RPC!)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 1) load all pending Ethereum deposits
  const unconfirmed = await prisma.deposit.findMany({
    where: { status: 'pending', network: 'ethereum' },
  })

  // 2) for each, fetch the receipt & current block, then approve if >12 confirmations

 const results = []
 for (const d of unconfirmed) {
   const receipt = await provider.getTransactionReceipt(d.txHash)
   if (receipt && receipt.blockNumber != null) {
     // fetch current block height
     const currentBlock = await provider.getBlockNumber()
     // if more than 12 blocks have passed since receipt.blockNumber...
     if (currentBlock - receipt.blockNumber > 12) {
       await prisma.deposit.update({
         where: { id: d.id },
        data: { status: 'approved' },
       })
       results.push(d.id)
     }
   }
 }

  return res.json({
    success: true,
    updated: results.length,
  })
}
