import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import pg from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  // If no connection string, return a client that will fail gracefully
  // The app will show a connection error rather than crash on startup
  if (!connectionString) {
    // Return a dummy client just so the app can start (pages that don't hit DB will work)
    console.warn("[db] DATABASE_URL not set — database features will not work");
    const pool = new pg.Pool({ connectionString: "postgresql://localhost:5432/" });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter } as any);
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
