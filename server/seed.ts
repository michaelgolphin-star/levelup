import dotenv from "dotenv";
import { ensureDb, createOrg, createUser, findUserByUsername } from "./storage.js";

dotenv.config();
ensureDb();

const username = (process.env.SEED_ADMIN_USERNAME || "admin").trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD || "admin123!";
const orgName = process.env.SEED_ORG_NAME || "Demo Org";

const existing = findUserByUsername(username);
if (existing) {
  console.log("ℹ️ Seed admin already exists:", username);
  process.exit(0);
}

const org = createOrg(orgName);
const user = createUser({ username, password, orgId: org.id, role: "admin" });

console.log("✅ Seeded:");
console.log("Org:", org);
console.log("Admin username:", user.username);
console.log("Admin password:", password);
