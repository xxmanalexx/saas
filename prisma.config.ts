// Prisma 7 config — tell the CLI which schema to use and how to connect.
// The datasource URL here is used by `prisma generate` and `prisma db push`.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  // The main schema used by the app
  schema: "./prisma/schema.sqlite.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"]!,
  },
});
