import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { registerRoutes } from "./routes.js";
import { ensureDb } from "./storage.js";

dotenv.config();

const PORT = Number(process.env.PORT || 8080);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

ensureDb();
registerRoutes(app);

// ---------- Static frontend serving (Railway/Prod-safe) ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When compiled, this file lives in: server/dist/index.js
// The Vite build output lives in: <root>/dist
// So from server/dist -> ../../dist
const distCandidates = [
  path.resolve(__dirname, "../../dist"),
  path.resolve(__dirname, "../dist"), // useful if running uncompiled in some environments
  path.resolve(process.cwd(), "dist"),
  path.resolve(process.cwd(), "client", "dist"),
];

const distPath =
  distCandidates.find((p) => {
    try {
      return (
        !!p &&
        require("node:fs").existsSync(p) &&
        require("node:fs").existsSync(path.join(p, "index.html"))
      );
    } catch {
      return false;
    }
  }) || distCandidates[0];

try {
  const fs = await import("node:fs");
  if (fs.existsSync(path.join(distPath, "index.html"))) {
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  } else {
    app.get("/", (_req, res) => {
      res
        .status(200)
        .send(
          "API is running. Frontend build not found. Expected index.html in one of: " +
            distCandidates.join(", "),
        );
    });
  }
} catch {
  app.get("/", (_req, res) => {
    res
      .status(200)
      .send(
        "API is running. Frontend build not found. Expected index.html in one of: " +
          distCandidates.join(", "),
      );
  });
}
// ---------------------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
