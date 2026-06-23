import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/api/message", (req, res) => {
  res.json({
    message: "Hello from Codesetu Express backend!",
    features: [
      "Turborepo monorepo setup",
      "Next.js (App Router) frontend",
      "Express.js & TypeScript backend",
      "Shared UI components package",
    ],
    timestamp: new Date().toISOString(),
  });
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
