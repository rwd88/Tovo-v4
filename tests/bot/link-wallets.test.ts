// tests/bot/link-wallets.test.ts

import bot from '../../src/bot/bot';
import { prisma } from '../../lib/prisma';

jest.mock('../../lib/prisma');

interface MockCtx {
  message: {
    text: string;
    chat: { id: number };
    from: { id: number; username?: string };
  };
  reply: jest.Mock;
}

function makeCtx(text: string): MockCtx {
  return {
    message: {
      text,
      chat: { id: 123 },
      from: { id: 123, username: 'testuser' },
    },
    reply: jest.fn(),
  };
}

describe('Wallet-linking commands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ===== link_solana ===== */

  it('/link_solana → usage when no address', async () => {
    const ctx = makeCtx('/link_solana');
    await bot.handleUpdate({ message: ctx.message });
    expect(ctx.reply).toHaveBeenCalledWith(
      'Usage: /link_solana <Solana address>'
    );
  });

  it('/link_solana → invalid address', async () => {
    const ctx = makeCtx('/link_solana WRONG123');
    await bot.handleUpdate({ message: ctx.message });
    expect(ctx.reply).toHaveBeenCalledWith(
      '❌ That doesn’t look like a valid Solana address.'
    );
  });

  it('/link_solana → success', async () => {
    prisma.user.upsert.mockResolvedValue({});
    const addr = 'GQdqVArgxjh3zMDSkEPvYkFhgLRPrZdJAHwV8hhVniCT';
    const ctx = makeCtx(`/link_solana ${addr}`);
    await bot.handleUpdate({ message: ctx.message });
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { telegramId: '123' },
        update: { solanaWallet: addr },
        create: expect.objectContaining({ solanaWallet: addr }),
      })
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      `✅ Linked your Solana wallet: \`${addr}\``
    );
  });

  /* ===== link_bsc ===== */

  it('/link_bsc → invalid address', async () => {
    const ctx = makeCtx('/link_bsc 12345');
    await bot.handleUpdate({ message: ctx.message });
    expect(ctx.reply).toHaveBeenCalledWith(
      '❌ That doesn’t look like a valid BSC/ETH address.'
    );
  });

  it('/link_bsc → success', async () => {
    prisma.user.upsert.mockResolvedValue({});
    const addr = '0x12758f420d07a6bE2e7B6D404d5BE7e4f73E85b8';
    const ctx = makeCtx(`/link_bsc ${addr}`);
    await bot.handleUpdate({ message: ctx.message });
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { telegramId: '123' },
        update: { bscWallet: addr },
        create: expect.objectContaining({ bscWallet: addr }),
      })
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      `✅ Linked your BSC wallet: \`${addr}\``
    );
  });

  /* ===== link_erc20 ===== */

  it('/link_erc20 → invalid address', async () => {
    const ctx = makeCtx('/link_erc20 foo');
    await bot.handleUpdate({ message: ctx.message });
    expect(ctx.reply).toHaveBeenCalledWith(
      '❌ That doesn’t look like a valid ERC-20 (Ethereum) address.'
    );
  });

  it('/link_erc20 → success', async () => {
    prisma.user.upsert.mockResolvedValue({});
    const addr = '0x12758f420d07a6bE2e7B6D404d5BE7e4f73E85b8';
    const ctx = makeCtx(`/link_erc20 ${addr}`);
    await bot.handleUpdate({ message: ctx.message });
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { telegramId: '123' },
        update: { erc20Wallet: addr },
        create: expect.objectContaining({ erc20Wallet: addr }),
      })
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      `✅ Linked your ERC-20 wallet: \`${addr}\``
    );
  });

  /* ===== link_trc20 ===== */

  it('/link_trc20 → invalid address', async () => {
    const ctx = makeCtx('/link_trc20 12345');
    await bot.handleUpdate({ message: ctx.message });
    expect(ctx.reply).toHaveBeenCalledWith(
      '❌ That doesn’t look like a valid TRC-20 (Tron) address.'
    );
  });

  it('/link_trc20 → success', async () => {
    prisma.user.upsert.mockResolvedValue({});
    const addr = 'TXndnjJSJUhBfHKxqeqeR6u7pZJ36HATBY';
    const ctx = makeCtx(`/link_trc20 ${addr}`);
    await bot.handleUpdate({ message: ctx.message });
    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { telegramId: '123' },
        update: { trc20Wallet: addr },
        create: expect.objectContaining({ trc20Wallet: addr }),
      })
    );
    expect(ctx.reply).toHaveBeenCalledWith(
      `✅ Linked your TRC-20 wallet: \`${addr}\``
    );
  });
});
