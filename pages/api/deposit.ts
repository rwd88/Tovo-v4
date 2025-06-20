import type { NextApiRequest, NextApiResponse } from 'next';

// In-memory store (replace later with DB logic)
const deposits: { network: string; txHash: string; timestamp: string }[] = [];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { network, txHash } = req.body;

  if (!network || !txHash) {
    return res.status(400).json({ error: 'Missing network or txHash' });
  }

  deposits.push({
    network,
    txHash,
    timestamp: new Date().toISOString(),
  });

  console.log(`[Deposit] ${network}: ${txHash}`);

  return res.status(200).json({ success: true });
}
