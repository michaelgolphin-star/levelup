// server/index.ts (FULL REPLACEMENT)
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

// Allow Railway app + local dev. Add custom domains here later.
const ALLOWED_ORIGINS = new Set(
  [
    "https://levelup-production-ced0.up.railway.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]
    .map((s) => s.trim())
    .filter(Boolean),
);

function corsOriginCheck(origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) {
  // Allow server-to-server / curl / same-origin (no Origin header)
  if (!origin) return cb(null, true);

  // Exact match allowlist
  if (ALLOWED_ORIGINS.has(origin)) return cb(null, true);

  // Allow any Railway subdomain of your project (covers preview URLs if you enable them)
  try {
    const u = new URL(origin);
    if (u.protocol === "https:" && u.hostname.endsWith(".up.railway.app")) return cb(null, true);
  } catch {
    // ignore
  }

  return cb(new Error("CORS blocked: origin not allowed"));
}

async function main() {
  const app = express();

  // Railway runs behind a reverse proxy
  app.set("trust proxy", 1);

  // Small hardening: hide Express fingerprint
  app.disable("x-powered-by");

  // CORS (locked down)
  app.use(
    cors({
      origin: corsOriginCheck,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  // Basic security headers
  app.use(
    helmet({
      // keep this simple for now; add CSP later once you know exactly what you load
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan("dev"));

  // Global rate limit
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Stricter rate limit for auth endpoints (brute-force protection)
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many auth attempts. Try again later." },
  });
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api/auth/request-reset", authLimiter);
  app.use("/api/auth/reset", authLimiter);

  // DB must be ready before routes
  await ensureDb();

  // API routes (routes.ts includes its own JSON error handler at the end)
  registerRoutes(app);

  // --- Serve built frontend (Vite output) ---
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

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
    console.log(`✅ Allowed origins: ${Array.from(ALLOWED_ORIGINS).join(", ")}`);
  });
}

main().catch((err) => {
  console.error("❌ Fatal startup error:", err);
  process.exit(1);
});
