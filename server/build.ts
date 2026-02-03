import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const outDir = path.resolve("server/dist");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

execSync("npx tsc -p tsconfig.server.json", { stdio: "inherit" });
