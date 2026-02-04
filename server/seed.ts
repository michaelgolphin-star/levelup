import dotenv from "dotenv";
import { ensureDb, createOrg, createUser, findUserByUsername } from "./storage.js";

dotenv.config();
await ensureDb();

const orgName = process.env.SEED_ORG || "My Org";
const username = process.env.SEED_USER || "admin";
const password = process.env.SEED_PASS || "admin123";

const existing = await findUserByUsername(username);
if (existing) {
  console.log("Seed user already exists:", existing.username);
  process.exit(0);
}

const org = await createOrg(orgName);
const user = await createUser({ username, password, orgId: org.id, role: "admin" });

console.log("Seeded:", { org, user: { id: user.id, username: user.username, role: user.role } });
