// pages/api/deposits/evm.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { ethers } from "ethers";
import prisma from "../../../lib/prisma";

const provider = new ethers.providers.JsonRpcProvider(process.env.ETH_RPC);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Query unconfirmed deposit requests from DB
  const pending = await prisma.deposit.findMany({ where: { status: "pending", network: "ethereum" } });
  for (const d of pending) {
    const receipt = await provider.getTransactionReceipt(d.txHash);
    if (receipt && receipt.confirmations >= 12) {
      // credit user
      await prisma.user.update({
        where: { telegramId: d.userTelegramId },
        data: { balance: { increment: d.amount } }
      });
      await prisma.deposit.update({ where: { id: d.id }, data: { status: "confirmed" } });
    }
  }
  res.status(200).json({ ok: true, processed: pending.length });
}
