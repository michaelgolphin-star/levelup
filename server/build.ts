// server/build.ts (FULL REPLACEMENT)
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

console.log("🔨 Building server...");

const outDir = path.resolve("server/dist");
fs.mkdirSync(outDir, { recursive: true });

// Compile TS -> JS
execSync("npx tsc -p tsconfig.server.json", { stdio: "inherit" });

// Your tsconfig.server.json uses rootDir:"server" + outDir:"server/dist"
// so TS often emits to: server/dist/server/index.js
// Railway start expects: server/dist/index.js
const expected = path.resolve("server/dist/index.js");
const actual = path.resolve("server/dist/server/index.js");

if (fs.existsSync(actual)) {
  fs.copyFileSync(actual, expected);
  console.log("✅ Ensured server/dist/index.js (copied from server/dist/server/index.js)");
} else if (!fs.existsSync(expected)) {
  console.warn("⚠️ Server build finished but no entry file found at:");
  console.warn(" -", expected);
  console.warn(" -", actual);
}

console.log("✅ Server build complete");
