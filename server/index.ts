import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { registerRoutes } from "./routes.js";
import { ensureDb } from "./storage.js";

dotenv.config();

const PORT = Number(process.env.PORT || 8080);

const app = express();

// Railway sits behind a proxy
app.set("trust proxy", 1);

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
  })
);

ensureDb();
registerRoutes(app);

// Serve built client (Vite build output)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distPath = path.resolve(__dirname, "../dist");
const indexHtml = path.join(distPath, "index.html");

if (fs.existsSync(indexHtml)) {
  app.use(express.static(distPath));

  // SPA fallback
  app.get("*", (_req, res) => {
    res.sendFile(indexHtml);
  });

  console.log(`✅ Serving frontend from: ${distPath}`);
} else {
  console.warn(`⚠️ Frontend not found at: ${indexHtml}`);

  // Keep API working even if frontend isn't present
  app.get("/", (_req, res) => res.status(200).send("API is running. Frontend build not found."));
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
