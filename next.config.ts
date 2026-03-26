import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@prisma/adapter-libsql",
    "@prisma/adapter-pg",
    "@prisma/adapter-better-sqlite3",
    "@libsql/client",
    "pg",
    "better-sqlite3",
  ],
};

export default nextConfig;
