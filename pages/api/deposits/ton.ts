import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const deposits = await prisma.onChainDeposit.findMany({
      where: { chainId: Number(process.env.TON_CHAIN_ID) },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(deposits);
  } catch (error) {
    console.error('Failed to fetch TON deposits:', error);
    res.status(500).json({ error: 'Unable to fetch TON deposits' });
  }
}