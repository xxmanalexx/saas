/**
 * Database client using Prisma with the @prisma/adapter-pg driver for Neon PostgreSQL.
 *
 * All existing `await db.xxx()` call sites work unchanged.
 */
import "dotenv/config";

type PrismaClient = import("@prisma/client").PrismaClient;

const _global = globalThis as unknown as { _prisma: PrismaClient | null };

function createPrismaClient(): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as { Pool: new (opts: object) => unknown };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require("@prisma/adapter-pg") as { PrismaPg: new (pool: unknown) => unknown };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require("@prisma/client") as { PrismaClient: new (opts: unknown) => PrismaClient };

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any);
}

function getPrisma(): PrismaClient {
  if (!_global._prisma) {
    _global._prisma = createPrismaClient();
  }
  return _global._prisma;
}

/**
 * Lazy async proxy so all `await db.xxx()` call sites work unchanged.
 * Also enables `await db` (returns a Promise<PrismaClient>).
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (prop === "then" || prop === "catch" || prop === "finally") {
      // Enables `await db` — getPrisma() returns PrismaClient (not a Promise)
      return ((async () => getPrisma()) as unknown as Promise<PrismaClient>)[prop as keyof Promise<PrismaClient>];
    }
    if (prop === Symbol.toStringTag) return "PrismaClient";

    return new Proxy({}, {
      get(_t, subProp) {
        if (subProp === "then" || subProp === "catch" || subProp === "finally") return;
        return async (...args: unknown[]) => {
          const client = getPrisma() as unknown as Record<string, Record<string, unknown>>;
          const model = client[prop as string];
          if (!model) return undefined;
          const fn = model[subProp as string];
          return typeof fn === "function" ? (fn as Function).call(model, ...args) : fn;
        };
      },
    });
  },
});

// Direct client for auth.ts adapter
export function getPrismaDb(): PrismaClient {
  return getPrisma();
}
