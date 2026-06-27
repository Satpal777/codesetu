import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { inngestServe } from "@repo/inngest/serve";
import { auth } from "./auth.js";
import { config } from "./config/index.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/error.middleware.js";

const app = express();

// CORS must allow credentials so the browser sends/receives the session cookie.
app.use(
  cors({
    origin: config.clientUrl,
    credentials: true,
  })
);

// Better Auth mounts its own Node handler and reads the raw request body,
// so it MUST come before express.json() — otherwise the body is already
// consumed and POST routes (sign-in/social, sign-out, …) fail with a 500.
app.all("/api/auth/*", toNodeHandler(auth));

app.use(express.json());

// Inngest's serve endpoint (function registration + step execution).
// Mounted before the "/api" router so its catch-all doesn't swallow these
// requests. In dev, the Inngest Dev Server discovers it at this URL.
app.use("/api/inngest", inngestServe());

app.use("/api", apiRouter);

app.use(errorHandler);

export default app;
