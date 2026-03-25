#!/usr/bin/env node
/**
 * setup-sqlite.js — Zero-setup SQLite database for Rana.
 *
 * Run once:
 *   node scripts/setup-sqlite.js
 *
 * This script:
 *   1. Removes the prisma.config.ts (incompatible with dual-driver setup)
 *   2. Sets .env to use SQLite
 *   3. Reads prisma/schema.sqlite.prisma and creates all tables via better-sqlite3
 *   4. Verifies by counting tables
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SQLITE_PATH = path.join(ROOT, "data", "rana.db");
const SQLITE_URL = `file:${SQLITE_PATH}`;
const SCHEMA_PATH = path.join(ROOT, "prisma", "schema.sqlite.prisma");

// ── Step 1: Remove prisma.config.ts (not needed for SQLite) ──────────────────
const configPath = path.join(ROOT, "prisma.config.ts");
if (fs.existsSync(configPath)) {
  fs.unlinkSync(configPath);
  console.log("[setup] Removed prisma.config.ts (SQLite uses direct driver)");
}

// ── Step 2: Update .env ──────────────────────────────────────────────────────
const envPath = path.join(ROOT, ".env");
let envLines = fs.existsSync(envPath)
  ? fs.readFileSync(envPath, "utf8").split("\n")
  : [];
envLines = envLines.filter((l) => !l.startsWith("DATABASE_URL"));
envLines.push(`DATABASE_URL="${SQLITE_URL}"`);
fs.writeFileSync(envPath, envLines.join("\n") + "\n");
console.log(`[setup] .env → DATABASE_URL="${SQLITE_URL}"`);

// ── Step 3: Create data directory ─────────────────────────────────────────────
const dataDir = path.dirname(SQLITE_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (fs.existsSync(SQLITE_PATH)) fs.unlinkSync(SQLITE_PATH);
console.log(`[setup] Database: ${SQLITE_PATH}`);

// ── Step 4: Parse schema and build SQL ───────────────────────────────────────
const schema = fs.readFileSync(SCHEMA_PATH, "utf8");

// Extract all model blocks
const modelBlocks = [...schema.matchAll(/model (\w+) \{(.*?)\n\}/gs)];

function mapType(type, isList) {
  if (type === "String") return isList ? "TEXT" : "TEXT";
  if (type === "Int") return isList ? "INTEGER" : "INTEGER";
  if (type === "BigInt") return isList ? "INTEGER" : "INTEGER";
  if (type === "Float") return isList ? "REAL" : "REAL";
  if (type === "Boolean") return "INTEGER";
  if (type === "DateTime") return isList ? "TEXT" : "TEXT";
  if (type === "Json") return "TEXT";
  if (type === "Unsupported") return "TEXT";
  return type; // enum values stay as-is
}

function buildColumn(name, field) {
  const parts = [];
  // Type
  const isList = field.includes("[]");
  let type = field.replace(/\s*\[\]\s*$/, "").trim();
  type = type.split(" ")[0]; // take first token (e.g. "String?" → "String")
  type = type.replace(/\?$/, "");
  parts.push(mapType(type, isList));
  // Default
  if (field.includes("@default(autoincrement()")) parts.push("AUTOINCREMENT");
  if (field.includes("@default(now())")) parts.push(`DEFAULT (datetime('now'))`);
  if (field.includes("@default(cuid())")) parts.push(`DEFAULT (lower(hex(randomblob(16))))`);
  if (field.includes("@default(uuid())")) parts.push(`DEFAULT (lower(hex(randomblob(16))))`);
  if (field.includes("@default(true)")) parts.push("DEFAULT 1");
  if (field.includes("@default(false)")) parts.push("DEFAULT 0");
  // Not null
  if (!field.includes("?")) parts.push("NOT NULL");
  // Primary key
  if (field.includes("@id")) parts.push("PRIMARY KEY");
  // Unique
  if (field.includes("@unique")) parts.push("UNIQUE");
  return `  ${name} ${parts.join(" ")}`;
}

const tables = [];
for (const [, modelName, body] of modelBlocks) {
  const lines = body.trim().split("\n").filter((l) => !l.trim().startsWith("//"));
  const columns = [];
  const primaryKeys = [];
  const uniqueConstraints = [];
  const foreignKeys = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("@@")) {
      // Handle @@unique, @@index, @@id
      if (trimmed.startsWith("@@id")) {
        const match = trimmed.match(/@@id\(\[(\w+(?:,\s*\w+)*)\]\)/);
        if (match) primaryKeys.push(...match[1].split(",").map((s) => s.trim()));
      }
      if (trimmed.startsWith("@@unique")) {
        const match = trimmed.match(/@@unique\(\[(\w+(?:,\s*\w+)*)\]\)/);
        if (match) uniqueConstraints.push(match[1].split(",").map((s) => s.trim()));
      }
      continue;
    }
    if (trimmed.startsWith("@")) continue;

    // fieldName Type @attributes
    const parts = trimmed.split(/\s+/);
    const name = parts[0];
    const fieldDef = parts.slice(1).join(" ");

    if (name === "id" && fieldDef.includes("@id")) {
      columns.push(`  id TEXT PRIMARY KEY`);
      continue;
    }
    if (name === "createdAt" && fieldDef.includes("@default(now())")) {
      columns.push(`  createdAt TEXT DEFAULT (datetime('now'))`);
      continue;
    }
    if (name === "updatedAt" && fieldDef.includes("@updatedAt")) {
      columns.push(`  updatedAt TEXT`);
      continue;
    }

    const isList = fieldDef.includes("[]");
    let type = fieldDef.split(" ")[0].replace(/\?$/, "");
    const sqlType = mapType(type, isList);
    const colParts = [`  ${name} ${sqlType}`];

    if (fieldDef.includes("@id")) {
      colParts.push("PRIMARY KEY");
      if (type === "String") colParts.push(`DEFAULT (lower(hex(randomblob(16))))`);
    }
    if (fieldDef.includes("@default(autoincrement())")) colParts.push("AUTOINCREMENT");
    if (fieldDef.includes("@default(now())")) colParts.push(`DEFAULT (datetime('now'))`);
    if (fieldDef.includes("@default(cuid())")) colParts.push(`DEFAULT (lower(hex(randomblob(16))))`);
    if (fieldDef.includes("@default(uuid())")) colParts.push(`DEFAULT (lower(hex(randomblob(16))))`);
    if (fieldDef.includes("@default(true)")) colParts.push("DEFAULT 1");
    if (fieldDef.includes("@default(false)")) colParts.push("DEFAULT 0");
    if (!fieldDef.includes("?") && !fieldDef.includes("@id")) colParts.push("NOT NULL");

    columns.push(colParts.join(" "));
  }

  let sql = `CREATE TABLE IF NOT EXISTS ${modelName} (\n${columns.join(",\n")}\n)`;
  tables.push(sql);
}

// ── Step 5: Execute with better-sqlite3 ──────────────────────────────────────
let betterSqlite3;
try {
  betterSqlite3 = require("better-sqlite3");
} catch (e) {
  console.error("[setup] better-sqlite3 not found. Run: npm install better-sqlite3");
  process.exit(1);
}

const db = new betterSqlite3(SQLITE_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const executed = new Set();
for (const sql of tables) {
  const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
  if (!executed.has(tableName)) {
    db.exec(sql);
    executed.add(tableName);
    console.log(`[setup] Created table: ${tableName}`);
  }
}

// ── Step 6: Verify ────────────────────────────────────────────────────────────
const tableCount = db
  .prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table'")
  .get().c;
console.log(`[setup] Total tables: ${tableCount}`);
console.log(`[setup] ✅ SQLite setup complete!`);
console.log(`\nTo switch back to PostgreSQL:`);
console.log(`  1. Restore: cp prisma/schema.postgresql.prisma prisma/schema.prisma`);
console.log(`  2. Set: DATABASE_URL="postgresql://..."`);
console.log(`  3. Run: npm run dev\n`);

db.close();
