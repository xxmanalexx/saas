/**
 * Database client using Prisma — supports both PostgreSQL and SQLite.
 *
 *   postgresql://...  →  @prisma/adapter-pg   (Neon, production)
 *   file:...         →  @prisma/adapter-libsql (SQLite, zero-setup)
 *
 * All existing `await db.xxx()` call sites work unchanged.
 */
import "dotenv/config";

type PrismaClient = import("@prisma/client").PrismaClient;

const _global = globalThis as unknown as { _prisma: PrismaClient | null };

function isPostgres(): boolean {
  const url = (process.env.DATABASE_URL ?? "").trim();
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

function createPrismaClient(): PrismaClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require("@prisma/client") as { PrismaClient: new (opts: unknown) => PrismaClient };

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  if (isPostgres()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg") as { Pool: new (opts: object) => unknown };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg") as { PrismaPg: new (pool: unknown) => unknown };
    console.log("[db] Using PostgreSQL adapter");
    const pool = new Pool({ connectionString: url });
    const adapter = new PrismaPg(pool);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new PrismaClient({ adapter } as any);
  }

  // SQLite via @prisma/adapter-libsql + @libsql/client
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@libsql/client") as { createClient: (opts: object) => { execute: (sql: string, args?: unknown[]) => unknown; close: () => void } };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaLibSql } = require("@prisma/adapter-libsql") as { PrismaLibSql: new (client: unknown) => unknown };
  console.log(`[db] Using SQLite adapter: ${url}`);
  const libsql = createClient({ url });
  const adapter = new PrismaLibSql(libsql);
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
