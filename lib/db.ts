/**
 * Database client using Prisma with the PostgreSQL adapter (Neon).
 *
 * For local dev without Neon, set DATABASE_URL to a libsql:// or postgresql://
 * connection string and install the matching @prisma/adapter-*. The import
 * below is intentionally hard-coded to the postgresql output so that Turbopack
 * can resolve it at build time.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const _global = globalThis as unknown as {
  _prisma: PrismaClient | null;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = new PrismaPg(pool as any) as any;
  return new PrismaClient({ adapter } as any);
}

export function getPrisma(): PrismaClient {
  if (!_global._prisma) {
    _global._prisma = createPrismaClient();
  }
  return _global._prisma;
}

/** Lazy async proxy so existing `await db.xxx()` call sites work unchanged. */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (prop === "then" || prop === "catch" || prop === "finally") {
      // Enables `await db` — getPrisma() returns a PrismaClient (not a Promise)
      return ((async () => getPrisma()) as any)[prop as keyof Promise<PrismaClient>];
    }
    if (prop === Symbol.toStringTag) return "PrismaClient";

    return new Proxy({}, {
      get: (_t, subProp) => {
        return async (...args: unknown[]) => {
          const client = getPrisma() as unknown as Record<string, unknown>;
          const val = client[prop as string];
          return typeof val === "function"
            ? (val as Function).call(client, ...args)
            : val;
        };
      },
      apply(_t, _thisArg, args) {
        return (async () => {
          const client = getPrisma() as unknown as Record<string, unknown>;
          const fn = client[prop as string];
          return typeof fn === "function"
            ? (fn as Function).apply(client, args)
            : fn;
        })();
      },
    });
  },
});
