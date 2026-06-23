import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export * from "./schema.js";
export * from "drizzle-orm";

const databaseUrl = process.env.DATABASE_URL;

const pool = new pg.Pool({
  connectionString: databaseUrl || "postgres://postgres:postgres@localhost:5432/postgres",
  ssl: databaseUrl?.includes("neon.tech") ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });
export type DatabaseType = typeof db;
