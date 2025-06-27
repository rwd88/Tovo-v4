// pages/api/deposits/evm.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { JsonRpcProvider }                  from 'ethers'
import { prisma }                           from '../../../../lib/prisma'


// v6 style:
const provider = new JsonRpcProvider(
  process.env.ETH_RPC
)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // your existing handler logic...
  const unconfirmed = await prisma.deposit.findMany({
    where: { status: 'pending', network: 'ethereum' },
  })

  const results = await Promise.all(unconfirmed.map(async (d) => {
    const receipt = await provider.getTransactionReceipt(d.txHash)
    if (receipt && receipt.confirmations > 12) {
      await prisma.deposit.update({
        where: { id: d.id },
        data: { status: 'approved' },
      })
    }
    return d.id
  }))

  res.json({ success: true, updated: results.length })
}
