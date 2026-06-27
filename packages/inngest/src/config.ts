/**
 * Inngest runtime configuration.
 *
 * `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` are read automatically by the
 * SDK from the environment, so they are not surfaced here — they are only
 * needed against Inngest Cloud (production). Locally, the Inngest Dev Server
 * (`pnpm inngest:dev`) handles everything with no keys required.
 */
const isProduction = process.env.NODE_ENV === "production";

export const inngestConfig = {
  /** Stable identifier for this Inngest app. Keep it constant across deploys. */
  appId: process.env.INNGEST_APP_ID ?? "codesetu",

  /**
   * Dev mode talks to a local Inngest Dev Server instead of Inngest Cloud.
   * Defaults to "on" outside production; force with INNGEST_DEV=1 / =0.
   */
  isDev:
    process.env.INNGEST_DEV === "1"
      ? true
      : process.env.INNGEST_DEV === "0"
        ? false
        : !isProduction,
} as const;
