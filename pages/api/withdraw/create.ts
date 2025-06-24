/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { buildTypedData } from '../../../lib/eip712';

const WithdrawSchema = z.object({
  userId: z.string(),
  chain:  z.enum(['solana', 'bsc', 'erc20', 'trc20']),
  amount: z.number().gt(0),
});

interface ErrorResponse {
  error: string;
  details?: any;
}

interface SuccessResponse {
  success:   true;
  nonce:     string;
  typedData: any;
  expiresAt: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const parsed = WithdrawSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Invalid request', details: parsed.error.issues });
  }
  const { userId, chain, amount } = parsed.data;

  // 1️⃣ Check user balance
  const user = await prisma.user.findUnique({
    where: { telegramId: userId },
  });
  if (!user || user.balance < amount) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  // 2️⃣ Daily cap check (max 1000 units/day)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const agg = await prisma.withdrawal.aggregate({
    _sum: { amount: true },
    where: {
      userId,
      createdAt: { gte: todayStart },
      status:   { in: ['signed', 'completed'] },
    },
  });
  const used = agg._sum.amount ?? 0;
  if (used + amount > 1000) {
    return res.status(400).json({ error: 'Daily withdrawal cap exceeded' });
  }

  // 3️⃣ Create pending withdrawal
  const nonce     = uuidv4();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15m TTL
  await prisma.withdrawal.create({
    data: {
      userId,
      chain,
      amount,
      nonce,
      expiresAt,
      status: 'pending',
    },
  });

  // 4️⃣ Build EIP-712 typed data
  const typedData = buildTypedData({
    domain: { name: 'Tovo', version: '1' },
    types: {
      Withdrawal: [
        { name: 'userId', type: 'string' },
        { name: 'chain',  type: 'string' },
        { name: 'amount', type: 'uint256' },
        { name: 'nonce',  type: 'string' },
      ],
    },
    primaryType: 'Withdrawal',
    message:     { userId, chain, amount, nonce },
  });

  return res.status(200).json({
    success:   true,
    nonce,
    typedData,
    expiresAt: expiresAt.toISOString(),
  });
}
