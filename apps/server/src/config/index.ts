import dotenv from "dotenv";

dotenv.config();

const required = ["DATABASE_URL", "BETTER_AUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] as const;
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const port = parseInt(process.env.PORT || "5001", 10);

export const config = {
  port,
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL!,
  betterAuthSecret: process.env.BETTER_AUTH_SECRET!,
  betterAuthUrl: process.env.BETTER_AUTH_URL || `http://localhost:${port}/api/auth`,
  googleClientId: process.env.GOOGLE_CLIENT_ID!,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
};
