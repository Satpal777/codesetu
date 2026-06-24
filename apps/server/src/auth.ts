import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@repo/database";
import * as dbSchema from "@repo/database";
import { config } from "./config/index.js";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: dbSchema,
  }),
  secret: config.betterAuthSecret,
  baseURL: config.betterAuthUrl,
  basePath: "/api/auth",
  trustedOrigins: [config.clientUrl],
  socialProviders: {
    google: {
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
    },
  },
});
