import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export * from "./schema.js";
export * from "drizzle-orm";

// This package is imported standalone (drizzle-kit, scripts) and by the server,
// so it loads its own env via dotenv instead of relying on the consumer's load
// order. dotenv never overrides vars already present, so the first source wins:
// an explicitly-set var, then the repo-root .env (source of truth), then mirrors.
const dir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: [
    path.resolve(dir, "../.env"), // packages/database/.env
    path.resolve(dir, "../../../.env"), // repo root .env (source of truth)
    path.resolve(dir, "../../../apps/server/.env"), // synced mirror
  ],
});

const databaseUrl = process.env.DATABASE_URL;

const pool = new pg.Pool({
  connectionString: databaseUrl || "postgres://postgres:postgres@localhost:5432/postgres",
  ssl: databaseUrl?.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
export type DatabaseType = typeof db;
