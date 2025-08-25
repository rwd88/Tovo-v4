// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

/**
 * Prisma must NOT be used in the Edge runtime.
 * If you ever import this in a route handler, ensure runtime: "nodejs".
 */
if (typeof (globalThis as any).EdgeRuntime !== 'undefined') {
  throw new Error(
    'Prisma is not supported in the Edge runtime. Move this logic to a Node.js runtime route.'
  );
}

// Use globalThis so it works in ESM everywhere (Node 18/20, Vercel)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const isDev = process.env.NODE_ENV !== 'production';

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
  });

/**
 * Identify transient/connection errors that are safe to retry once.
 */
function isTransientPrismaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;

  const anyErr = err as any;
  const code: string | undefined = anyErr.code;

  // Prisma known request/initialization error codes
  if (code === 'P1001' /* timeout */ || code === 'P1002' /* connection issue */) return true;

  // Message fragments commonly seen with serverless/pooled connections
  const msg = String(anyErr.message || '').toLowerCase();
  return (
    msg.includes('closed') ||
    msg.includes('connection closed') ||
    msg.includes('server closed the connection unexpectedly') ||
    msg.includes('terminating connection due to administrator command') ||
    msg.includes('econnreset') ||
    msg.includes('the server closed the connection')
  );
}

/**
 * Global middleware: timing + one-shot retry on transient errors.
 */
prisma.$use(async (params, next) => {
  const start = isDev ? Date.now() : 0;

  try {
    const result = await next(params);
    if (isDev) {
      const ms = Date.now() - start;
      // keep noise low in prod, useful in dev
      console.log(`🔍 prisma: ${params.model}.${params.action} took ${ms}ms`);
    }
    return result;
  } catch (err) {
    if (isTransientPrismaError(err)) {
      if (isDev) {
        console.warn(
          `⚠️ prisma transient error on ${params.model}.${params.action} — retrying once…`,
          (err as any)?.code || (err as any)?.message || err
        );
      }
      await new Promise((r) => setTimeout(r, 120)); // brief backoff
      return next(params);
    }
    throw err;
  }
});

// Keep a single instance in dev (Next hot-reload)
if (isDev) {
  globalForPrisma.prisma = prisma;
}

// Optional: graceful disconnect for local scripts / dev server shutdown
process.on('beforeExit', async () => {
  try {
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
});

export { prisma };
export default prisma;
