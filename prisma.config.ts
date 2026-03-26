// This file tells Prisma where to find the schema and how to connect.
// Prisma 7 reads DATABASE_URL from this config, not from the schema.prisma datasource block.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.postgresql.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
