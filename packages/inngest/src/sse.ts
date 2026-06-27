import { EventEmitter } from "events";

export interface PipelineUpdate {
  projectId: string;
  stage: string;
  status: string;
  artifact?: unknown;
}

/**
 * In-process pub/sub bridge between Inngest step functions and SSE clients.
 * Inngest runs as an Express middleware in the same Node.js process, so a
 * singleton EventEmitter connects stage progress to live SSE streams.
 */
export const pipelineEmitter = new EventEmitter();
pipelineEmitter.setMaxListeners(200);
