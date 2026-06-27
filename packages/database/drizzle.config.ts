import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

// Load DATABASE_URL via dotenv. The root `.env` is the source of truth;
// `scripts/sync-env.js` mirrors it into the apps. dotenv does not override
// vars already set, so an explicit env var still takes precedence.
dotenv.config({
  path: [
    path.resolve(dir, ".env"), // packages/database/.env
    path.resolve(dir, "../../.env"), // repo root .env (source of truth)
    path.resolve(dir, "../../apps/server/.env"), // synced mirror
  ],
});

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
