// Sample trade creation endpoint
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Validate: User balance, market status, etc.
  // 2. Create trade:
  await prisma.$transaction([
    prisma.trade.create({
      data: {
        userId: 'user123',
        marketId: 'market456',
        type: 'YES', // or 'NO'
        amount: 10.00,
        fee: 0.10 // 1% fee
      }
    }),
    prisma.user.update({
      where: { id: 'user123' },
      data: { balance: { decrement: 10.10 } }
    }),
    prisma.market.update({
      where: { id: 'market456' },
      data: { poolYes: { increment: 10.00 } } // or poolNo
    })
  ]);
  
  // 3. Notify channel
  await sendTelegramMessage(
    `🎯 New prediction: ${user} bet $10 on YES for "${market.question}"`,
    false,
    process.env.TG_CHANNEL_ID!
  );
}