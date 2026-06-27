import { Inngest } from "inngest";
import { inngestConfig } from "./config.js";

/**
 * The shared Inngest client — the one place events are sent from and the
 * client functions are bound to. Import this anywhere you need to
 * `inngest.send(...)`; import `functions` (from ./functions) only where the
 * serve handler is mounted.
 *
 * Event typing in v4 comes from the `eventType(...)` definitions in
 * ./events (used as triggers + `.create()`), not from a client-level schema.
 */
export const inngest = new Inngest({
  id: inngestConfig.appId,
  isDev: inngestConfig.isDev,
});

export type InngestClient = typeof inngest;
