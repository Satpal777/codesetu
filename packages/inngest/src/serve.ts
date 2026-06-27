import { serve } from "inngest/express";
import { inngest } from "./client.js";
import { functions } from "./functions/index.js";

/**
 * Pre-wired Express handler for the Inngest endpoint. The server only has to
 * mount it — it never touches the client or the function list directly:
 *
 *   import { inngestServe } from "@repo/inngest/serve";
 *   app.use("/api/inngest", inngestServe());
 *
 * Exposed from a dedicated subpath so framework-agnostic consumers can import
 * `@repo/inngest` (client + events) without pulling in the Express adapter.
 */
export const inngestServe = () => serve({ client: inngest, functions });
