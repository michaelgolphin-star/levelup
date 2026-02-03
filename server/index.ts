import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "node:fs";
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

// --- Serve built frontend (Vite output) ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When compiled, we run from: server/dist/index.js
// Frontend build is: <root>/dist
const distCandidates = [
  path.resolve(__dirname, "../../dist"),
  path.resolve(process.cwd(), "dist"),
  path.resolve(process.cwd(), "client", "dist"),
];

const distPath = distCandidates.find((p) => fs.existsSync(path.join(p, "index.html")));

if (distPath) {
  app.use(express.static(distPath));
  app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
} else {
  app.get("/", (_req, res) => {
    res
      .status(200)
      .send("API is running. Frontend build not found. Looked in: " + distCandidates.join(", "));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
