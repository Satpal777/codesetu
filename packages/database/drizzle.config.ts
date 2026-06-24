import { defineConfig } from "drizzle-kit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load DATABASE_URL from the repo's .env files without depending on dotenv
 * (which isn't a dependency of this package). The root `.env` is the source
 * of truth; `scripts/sync-env.js` mirrors it into the apps.
 */
function loadEnv() {
  if (process.env.DATABASE_URL) return;
  const candidates = [
    path.resolve(dir, ".env"),
    path.resolve(dir, "../../.env"),
    path.resolve(dir, "../../apps/server/.env"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && match[1] && !process.env[match[1]]) {
        process.env[match[1]] = match[2]!.replace(/^["']|["']$/g, "").trim();
      }
    }
  }
}

loadEnv();

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
