/**
 * @repo/inngest — the durable-jobs layer for Codesetu.
 *
 *   import { inngest, EVENTS } from "@repo/inngest";        // send events
 *   import { inngestServe } from "@repo/inngest/serve";     // mount handler
 *
 * The Express serve adapter lives behind the "./serve" subpath so importing
 * the client/events stays framework-agnostic.
 */
export { inngest, type InngestClient } from "./client.js";
export { functions } from "./functions/index.js";
export { inngestConfig } from "./config.js";
export * from "./events.js";
export { pipelineEmitter, type PipelineUpdate } from "./sse.js";
