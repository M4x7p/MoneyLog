import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { getRequestContext } from '@cloudflare/next-on-pages';

// Global cache to prevent multiple instances in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  // 1. Try Configured Cloudflare D1 (Edge)
  try {
    const ctx = getRequestContext();
    if (ctx && ctx.env && (ctx.env as any).DB) {
      const adapter = new PrismaD1((ctx.env as any).DB);
      return new PrismaClient({ adapter });
    }
  } catch (e) {
    // getRequestContext throws if not in request context
    // Continue to fallback
  }

  // 2. Fallback to Local LibSQL (SQLite file)
  const url = process.env.DATABASE_URL || 'file:./prisma/dev.db';
  const adapter = new PrismaLibSql({ url });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
};

// Use Proxy to lazy-load the client
// This ensures `getRequestContext()` is called within a request handle
export const prisma = new Proxy({} as PrismaClient, {
  get: (target, prop) => {
    // Initialize if not already doing so
    // Note: In Cloudflare Workers, we might want to re-check context? 
    // But usually standard singleton is fine per-isolate.
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient();
    }
    return (globalForPrisma.prisma as any)[prop];
  }
});

// Cache in development
if (process.env.NODE_ENV !== 'production') {
  // Actually, we can't cache the Proxy itself on the globalForPrisma object
  // because globalForPrisma expects PrismaClient type. 
  // But our Proxy acts as PrismaClient.
  // However, the proxy logic checks `globalForPrisma.prisma` which is the *real* client.
  // So we don't set globalForPrisma.prisma = prisma (the proxy).
  // We leave it managed by the proxy.
}

export default prisma;
