// pages/api/deposits/ton.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const deposits = await prisma.deposit.findMany({
      where: { chainId: Number(process.env.TON_CHAIN_ID) },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json(deposits);
  } catch (error) {
    console.error('🚨 TON deposits fetch error:', error);
    return res.status(500).json({ error: 'Unable to fetch TON deposits' });
  }
}
