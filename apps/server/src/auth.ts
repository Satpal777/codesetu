import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@repo/database";
import * as dbSchema from "@repo/database";
import { inngest, events } from "@repo/inngest";
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
  databaseHooks: {
    user: {
      create: {
        after: async (newUser) => {
          await inngest.send(
            events.userCreated.create({
              userId: newUser.id,
              email: newUser.email,
              name: newUser.name,
            })
          );
        },
      },
    },
  },
});
