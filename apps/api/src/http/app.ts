import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type { PracticeService } from "../application/PracticeService.js";
import { createApiRouter, errorHandler } from "./routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(service: PracticeService) {
  const app = express();
  const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: clientOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "256kb" }));
  app.use(cookieParser());

  app.use("/api", createApiRouter(service));

  const publicDir = path.resolve(__dirname, "../public");
  const webDist = path.resolve(__dirname, "../../../web/dist");
  const staticDir = fs.existsSync(webDist) ? webDist : publicDir;

  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get(/^(?!\/api).*/, (req, res, next) => {
      const indexHtml = path.join(staticDir, "index.html");
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        next();
      }
    });
  }

  app.use(errorHandler);

  return app;
}
