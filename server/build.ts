/**
 * Build step for Replit/Node:
 * We already built the client via vite build.
 * This step compiles server TS to JS into server/dist using a tiny TypeScript transpile via tsx.
 * Replit runs start -> node server/dist/index.js
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve("server/dist");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// Use tsc to emit server JS only.
execSync("npx tsc -p tsconfig.server.json", { stdio: "inherit" });
