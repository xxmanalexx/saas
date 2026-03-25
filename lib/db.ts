/**
 * Dynamic database client factory.
 *
 * Switches between two drivers based on DATABASE_URL:
 *   postgresql://...  →  @prisma/adapter-pg  (Neon, Supabase, local PG)
 *   file:./path.db   →  @prisma/adapter-libsql + @libsql/client (pure JS, zero-setup)
 *
 * Usage:
 *   DATABASE_URL="postgresql://..."   → uses existing PostgreSQL setup
 *   DATABASE_URL="file:./data/rana.db" → zero-setup local SQLite
 *
 * No code changes at any call site. All `await db.xxx()` calls work with
 * whichever driver is active.
 */
import "dotenv/config";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

type PgClient = import("@prisma/client").PrismaClient;
type SqliteClient = import("@prisma/client").PrismaClient;

const _global = globalThis as unknown as {
  _prismaPromise: Promise<PgClient | SqliteClient> | null;
};

// ── PostgreSQL ─────────────────────────────────────────────────────────────────
async function createPgClient(): Promise<PgClient> {
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { Pool } = await import("pg");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set for PostgreSQL");
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool as any) as any;
  return new PrismaClient({ adapter } as any);
}

// ── SQLite (pure JS via libSQL — zero native binaries) ───────────────────────
async function createSqliteClient(): Promise<SqliteClient> {
  // Import the SQLite-specific generated Prisma client
  // (generated from prisma/schema.sqlite.prisma → output ../node_modules/.prisma/client/sqlite)
  const sqliteClientPath = resolve(__dirname, "../node_modules/.prisma/client/sqlite/index.js");
  const { PrismaClient } = await import(sqliteClientPath);
  const { PrismaLibSql } = await import("@prisma/adapter-libsql");
  const { createClient } = await import("@libsql/client");

  const url = process.env.DATABASE_URL ?? "file:./data/rana.db";
  console.log(`[db] SQLite connecting to ${url}`);

  const libsql = createClient({ url });
  const adapter = new PrismaLibSql(libsql as any) as any;
  return new PrismaClient({ adapter } as any) as SqliteClient;
}

// ── Factory ────────────────────────────────────────────────────────────────────
async function createClient(): Promise<PgClient | SqliteClient> {
  const url = (process.env.DATABASE_URL ?? "").trim();

  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) {
    console.log("[db] Using PostgreSQL driver");
    return createPgClient();
  }

  console.log("[db] Using SQLite driver");
  return createSqliteClient();
}

function getPrismaPromise() {
  if (!_global._prismaPromise) {
    _global._prismaPromise = createClient();
  }
  return _global._prismaPromise;
}

// ── Async Proxy ───────────────────────────────────────────────────────────────
/**
 * `db` is a lazy async proxy. First property access triggers connection;
 * all calls are auto-awaited. Existing code works unchanged:
 *
 *   import { db } from "@/lib/db";
 *   await db.user.findMany();      ← first access: connects
 *   await db.conversation.findMany();
 */
export const db = new Proxy({} as PgClient, {
  get(_target, prop) {
    if (prop === "then" || prop === "catch" || prop === "finally") {
      // Handles `await db` gracefully — TypeScript doesn't know getPrismaPromise() is a Promise
      return ((getPrismaPromise() as unknown) as Promise<PgClient>)[prop as keyof Promise<PgClient>];
    }
    if (prop === Symbol.toStringTag) return "PrismaClientProxy";

    return new Proxy({}, {
      get: (_t, subProp) => {
        return async (...args: unknown[]) => {
          const client = await (getPrismaPromise() as unknown) as Record<string, unknown>;
          const val = client[prop as string];
          return typeof val === "function"
            ? (val as Function).call(client, ...args)
            : val;
        };
      },
      apply(_t, _thisArg, args) {
        return (async () => {
          const client = await (getPrismaPromise() as unknown) as Record<string, unknown>;
          const fn = client[prop as string];
          return typeof fn === "function"
            ? (fn as Function).apply(client, args)
            : fn;
        })();
      },
    });
  },
});

export async function getDb(): Promise<PgClient | SqliteClient> {
  return getPrismaPromise();
}
