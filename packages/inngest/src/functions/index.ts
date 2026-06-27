import { runPipeline } from "./pipeline.js";
import { sendWelcomeEmail } from "./user.js";

/**
 * The function registry. Every Inngest function MUST be listed here to be
 * served and discoverable by Inngest. Add new functions to this array.
 */
export const functions = [runPipeline, sendWelcomeEmail];

export { runPipeline, sendWelcomeEmail };
