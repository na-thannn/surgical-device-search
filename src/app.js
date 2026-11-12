import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";

import { config } from "./config.js";
import { createDeviceRouter } from "./routes/deviceRoutes.js";
import { createFeedbackRouter } from "./routes/feedbackRoutes.js";
import { createSearchRouter } from "./routes/searchRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicPath = path.join(__dirname, "../public");

export function createApp(dependencies = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.static(publicPath));

  app.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  app.use(
    "/api",
    createSearchRouter(dependencies),
    createDeviceRouter(dependencies),
    createFeedbackRouter(dependencies)
  );

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    console.error(err);
    return res.status(500).json({
      error: "Internal server error",
      detail: config.nodeEnv === "development" ? err.message : undefined
    });
  });

  return app;
}
