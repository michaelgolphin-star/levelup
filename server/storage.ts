// server/storage.ts (FULL REPLACEMENT — supports Option A + Option B + fixes "resolved")
import { Pool } from "pg";
import { nanoid } from "nanoid";
import { hashPassword } from "./auth.js";
import type { Role } from "./types.js";

/**
 * Postgres storage (Railway friendly)
 *
 * Required env:
 *   DATABASE_URL=postgres://...
 * Optional:
 *   PGSSLMODE=require
 */
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Add Railway Postgres and set DATABASE_URL.");
}

// SSL behavior:
// - if PGSSLMODE=require OR URL includes sslmode=require => ssl on
// - else ssl off (works locally)
const sslRequired =
  (process.env.PGSSLMODE || "").toLowerCase() === "require" ||
  DATABASE_URL.toLowerCase().includes("sslmode=require");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: sslRequired ? { rejectUnauthorized: false } : undefined,
});

async function q<T = any>(text: string, params: any[] = []) {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

/**
 * pg does NOT allow multiple SQL commands in one prepared statement.
 * So we execute statements one-by-one.
 */
async function execMany(statements: string[]) {
  for (const s of statements) {
    const sql = s.trim();
    if (!sql) continue;
    await q(sql);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function dayKeyFromIso(iso: string) {
  return iso.slice(0, 10);
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function toInt(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTags(tags: any): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => String(t ?? "").trim())
    .filter(Boolean)
    .slice(0, 20);
}

/**
 * Hardened JSONB array reader:
 * - pg often returns JSONB as JS arrays/objects
 * - but some environments/type-parsers can return strings
 */
function readJsonbArray(value: any): string[] {
  if (Array.isArray(value)) return normalizeTags(value);

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return normalizeTags(parsed);
    } catch {
      // fall through
    }
  }

  return [];
}

/** Outlet / grievance sessions */
export type OutletVisibility = "private" | "manager" | "admin";
export type OutletStatus = "open" | "escalated" | "closed" | "resolved";
export type OutletSender = "user" | "ai" | "staff";

/** ✅ Option B: confessional as a “kind” inside outlet_sessions */
export type OutletKind = "outlet" | "confessional";

function normalizeVisibility(v: any): OutletVisibility {
  const s = String(v || "").toLowerCase();
  if (s === "manager") return "manager";
  if (s === "admin") return "admin";
  return "private";
}

function normalizeStatus(v: any): OutletStatus {
  const s = String(v || "").toLowerCase();
  if (s === "resolved") return "resolved";
  if (s === "escalated") return "escalated";
  if (s === "closed") return "closed";
  return "open";
}

function normalizeSender(v: any): OutletSender {
  const s = String(v || "").toLowerCase();
  if (s === "ai") return "ai";
  if (s === "staff") return "staff";
  return "user";
}

function normalizeKind(v: any): OutletKind {
  const s = String(v || "").toLowerCase();
  if (s === "confessional") return "confessional";
  return "outlet";
}

/**
 * ensureDb()
 * - Creates tables if missing
 * - Migrates existing tables safely using ADD COLUMN IF NOT EXISTS
 * - Creates indexes only after columns are guaranteed to exist
 *
 * IMPORTANT: We run statements one-by-one to avoid:
 * "cannot insert multiple commands into a prepared statement"
 */
export async function ensureDb() {
  const now = nowIso();

  // 1) Base tables (one statement each)
  await execMany([
    `
    CREATE TABLE IF NOT EXISTS orgs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `
    CREATE TABLE IF NOT EXISTS checkins (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ts TEXT NOT NULL,
      day_key TEXT NOT NULL,
      mood INTEGER NOT NULL,
      energy INTEGER NOT NULL,
      stress INTEGER NOT NULL,
      note TEXT,
      tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TEXT NOT NULL
    )`,
    `
    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      target_per_week INTEGER NOT NULL,
      archived_at TEXT,
      created_at TEXT NOT NULL
    )`,
    `
    CREATE TABLE IF NOT EXISTS invites (
      token TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
    )`,
    `
    CREATE TABLE IF NOT EXISTS password_resets (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
    )`,
    `
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      full_name TEXT,
      email TEXT,
      phone TEXT,
      tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `
    CREATE TABLE IF NOT EXISTS user_notes (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ts TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,

    // ✅ Option A: Confessional entries (private journal) — separate table
    `
    CREATE TABLE IF NOT EXISTS confessional_entries (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      tags_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TEXT NOT NULL
    )`,

    // ✅ Outlet sessions (grievance office)
    `
    CREATE TABLE IF NOT EXISTS outlet_sessions (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

      -- ✅ Option B: session kind (outlet vs confessional)
      kind TEXT NOT NULL DEFAULT 'outlet',

      visibility TEXT NOT NULL DEFAULT 'private',
      category TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      risk_level INTEGER NOT NULL DEFAULT 0,

      last_message_at TEXT,
      last_sender TEXT,
      message_count INTEGER NOT NULL DEFAULT 0,

      resolution_note TEXT,
      resolved_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      resolved_at TEXT,

      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `
    CREATE TABLE IF NOT EXISTS outlet_messages (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL REFERENCES outlet_sessions(id) ON DELETE CASCADE,
      sender TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
    `
    CREATE TABLE IF NOT EXISTS outlet_escalations (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
      session_id TEXT NOT NULL REFERENCES outlet_sessions(id) ON DELETE CASCADE,
      escalated_to_role TEXT NOT NULL,
      assigned_to_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    )`,
  ]);

  // 2) Migration safety: add missing columns (each statement separately)
  await execMany([
    `ALTER TABLE outlet_sessions ADD COLUMN IF NOT EXISTS kind TEXT`,
    `ALTER TABLE outlet_sessions ADD COLUMN IF NOT EXISTS visibility TEXT`,
    `ALTER TABLE outlet_sessions ADD COLUMN IF NOT EXISTS category TEXT`,
    `ALTER TABLE outlet_sessions ADD COLUMN IF NOT EXISTS status TEXT`,
    `ALTER TABLE outlet_sessions ADD COLUMN IF NOT EXISTS risk_level INTEGER`,
    `ALTER TABLE outlet_sessions ADD COLUMN IF NOT EXISTS last_message_at TEXT`,
    `ALTER TABLE outlet_sessions ADD COLUMN IF NOT EXISTS last_sender TEXT`,
    `ALTER TABLE outlet_sessions ADD COLUMN IF NOT EXISTS message_count INTEGER`,
    `ALTER TABLE outlet_sessions ADD COLUMN IF NOT EXISTS resolution_note TEXT`,
    `ALTER TABLE outlet_sessions ADD COLUMN IF NOT EXISTS resolved_by_user_id TEXT`,
    `ALTER TABLE outlet_sessions ADD COLUMN IF NOT EXISTS resolved_at TEXT`,
    `ALTER TABLE outlet_sessions ADD COLUMN IF NOT EXISTS created_at TEXT`,
    `ALTER TABLE outlet_sessions ADD COLUMN IF NOT EXISTS updated_at TEXT`,
  ]);

  // Defaults for existing rows where columns were just added
  await q(`UPDATE outlet_sessions SET kind = COALESCE(NULLIF(kind,''), 'outlet')`);
  await q(`UPDATE outlet_sessions SET visibility = COALESCE(visibility, 'private')`);
  await q(`UPDATE outlet_sessions SET status = COALESCE(status, 'open')`);
  await q(`UPDATE outlet_sessions SET risk_level = COALESCE(risk_level, 0)`);
  await q(`UPDATE outlet_sessions SET message_count = COALESCE(message_count, 0)`);
  await q(`UPDATE outlet_sessions SET created_at = COALESCE(created_at, updated_at, $1)`, [now]);
  await q(`UPDATE outlet_sessions SET updated_at = COALESCE(updated_at, created_at, $1)`, [now]);

  // 3) Indexes (one statement each)
  await execMany([
    `CREATE INDEX IF NOT EXISTS idx_checkins_org_day ON checkins(org_id, day_key)`,
    `CREATE INDEX IF NOT EXISTS idx_checkins_user_day ON checkins(user_id, day_key)`,
    `CREATE INDEX IF NOT EXISTS idx_checkins_user_ts ON checkins(user_id, ts)`,

    `CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id, archived_at)`,

    `CREATE INDEX IF NOT EXISTS idx_invites_org ON invites(org_id, expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_pwreset_user ON password_resets(user_id, expires_at)`,

    `CREATE INDEX IF NOT EXISTS idx_profiles_org ON user_profiles(org_id)`,

    `CREATE INDEX IF NOT EXISTS idx_notes_user ON user_notes(org_id, user_id, ts)`,

    // ✅ confessional indexes (Option A)
    `CREATE INDEX IF NOT EXISTS idx_confessional_user_created ON confessional_entries(user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_confessional_org_created ON confessional_entries(org_id, created_at DESC)`,

    // ✅ outlet indexes (Option B included)
    `CREATE INDEX IF NOT EXISTS idx_outlet_sessions_org_kind_updated ON outlet_sessions(org_id, kind, updated_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_outlet_sessions_user_updated ON outlet_sessions(user_id, updated_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_outlet_sessions_visibility ON outlet_sessions(org_id, visibility)`,
    `CREATE INDEX IF NOT EXISTS idx_outlet_sessions_status ON outlet_sessions(org_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_outlet_sessions_lastmsg ON outlet_sessions(org_id, last_message_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_outlet_messages_session_created ON outlet_messages(session_id, created_at ASC)`,

    `CREATE INDEX IF NOT EXISTS idx_outlet_escalations_session ON outlet_escalations(session_id, created_at DESC)`,
  ]);
}

/** Orgs */
export async function createOrg(name: string) {
  const org = { id: nanoid(), name: name.trim(), createdAt: nowIso() };
  await q("INSERT INTO orgs (id, name, created_at) VALUES ($1, $2, $3)", [org.id, org.name, org.createdAt]);
  return org;
}

export async function getOrg(orgId: string) {
  const rows = await q<{ id: string; name: string; created_at: string }>(
    "SELECT id, name, created_at FROM orgs WHERE id = $1",
    [orgId],
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

/** Users */
export async function createUser(params: { username: string; password: string; orgId: string; role: Role }) {
  const user = {
    id: nanoid(),
    username: normalizeUsername(params.username),
    passwordHash: hashPassword(params.password),
    orgId: params.orgId,
    role: params.role,
    createdAt: nowIso(),
  };

  await q(
    "INSERT INTO users (id, username, password_hash, org_id, role, created_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [user.id, user.username, user.passwordHash, user.orgId, user.role, user.createdAt],
  );

  return user;
}

export async function findUserByUsername(username: string) {
  const u = normalizeUsername(username);
  const rows = await q<any>("SELECT * FROM users WHERE username = $1", [u]);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    orgId: row.org_id,
    role: row.role as Role,
    createdAt: row.created_at,
  };
}

export async function getUserById(userId: string) {
  const rows = await q<any>("SELECT * FROM users WHERE id = $1", [userId]);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    orgId: row.org_id,
    role: row.role as Role,
    createdAt: row.created_at,
  };
}

export async function listUsers(orgId: string) {
  const rows = await q<any>(
    "SELECT id, username, org_id, role, created_at FROM users WHERE org_id = $1 ORDER BY created_at DESC",
    [orgId],
  );
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    orgId: r.org_id,
    role: r.role as Role,
    createdAt: r.created_at,
  }));
}

export async function setUserRole(orgId: string, userId: string, role: Role) {
  const rows = await q<{ count: string }>(
    "WITH upd AS (UPDATE users SET role = $1 WHERE id = $2 AND org_id = $3 RETURNING 1) SELECT COUNT(*)::text as count FROM upd",
    [role, userId, orgId],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

/** Check-ins */
export async function createCheckIn(params: {
  orgId: string;
  userId: string;
  ts?: string;
  mood: number;
  energy: number;
  stress: number;
  note?: string | null;
  tags?: string[];
}) {
  const ts = params.ts || nowIso();
  const tags = normalizeTags(params.tags ?? []);

  const checkin = {
    id: nanoid(),
    orgId: params.orgId,
    userId: params.userId,
    ts,
    dayKey: dayKeyFromIso(ts),
    mood: params.mood,
    energy: params.energy,
    stress: params.stress,
    note: params.note ?? null,
    tags,
    tagsJson: JSON.stringify(tags),
    createdAt: nowIso(),
  };

  await q(
    `INSERT INTO checkins (id, org_id, user_id, ts, day_key, mood, energy, stress, note, tags_json, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      checkin.id,
      checkin.orgId,
      checkin.userId,
      checkin.ts,
      checkin.dayKey,
      checkin.mood,
      checkin.energy,
      checkin.stress,
      checkin.note,
      checkin.tags,
      checkin.createdAt,
    ],
  );

  return checkin;
}

export async function listCheckIns(params: { orgId: string; userId?: string; dayKey?: string; limit?: number }) {
  const limit = Math.max(1, Math.min(params.limit ?? 200, 500));

  const where: string[] = ["org_id = $1"];
  const args: any[] = [params.orgId];
  let i = 2;

  if (params.userId) {
    where.push(`user_id = $${i++}`);
    args.push(params.userId);
  }
  if (params.dayKey) {
    where.push(`day_key = $${i++}`);
    args.push(params.dayKey);
  }

  args.push(limit);
  const sql = `SELECT * FROM checkins WHERE ${where.join(" AND ")} ORDER BY ts DESC LIMIT $${i}`;
  const rows = await q<any>(sql, args);

  return rows.map((r) => {
    const tags = readJsonbArray(r.tags_json);
    return {
      id: r.id,
      orgId: r.org_id,
      userId: r.user_id,
      ts: r.ts,
      dayKey: r.day_key,
      mood: r.mood,
      energy: r.energy,
      stress: r.stress,
      note: r.note,
      tags,
      tagsJson: JSON.stringify(tags),
      createdAt: r.created_at,
    };
  });
}

export async function deleteCheckIn(orgId: string, userId: string, checkInId: string) {
  const rows = await q<{ count: string }>(
    "WITH del AS (DELETE FROM checkins WHERE id = $1 AND org_id = $2 AND user_id = $3 RETURNING 1) SELECT COUNT(*)::text as count FROM del",
    [checkInId, orgId, userId],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

/** Habits */
export async function createHabit(params: { orgId: string; userId: string; name: string; targetPerWeek: number }) {
  const habit = {
    id: nanoid(),
    orgId: params.orgId,
    userId: params.userId,
    name: params.name.trim(),
    targetPerWeek: params.targetPerWeek,
    archivedAt: null as string | null,
    createdAt: nowIso(),
  };

  await q(
    `INSERT INTO habits (id, org_id, user_id, name, target_per_week, archived_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [habit.id, habit.orgId, habit.userId, habit.name, habit.targetPerWeek, habit.archivedAt, habit.createdAt],
  );

  return habit;
}

export async function listHabits(params: { orgId: string; userId: string; includeArchived?: boolean }) {
  const includeArchived = !!params.includeArchived;
  const sql = `SELECT * FROM habits WHERE org_id = $1 AND user_id = $2 ${
    includeArchived ? "" : "AND archived_at IS NULL"
  } ORDER BY created_at DESC`;
  const rows = await q<any>(sql, [params.orgId, params.userId]);

  return rows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    userId: r.user_id,
    name: r.name,
    targetPerWeek: r.target_per_week,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
  }));
}

export async function archiveHabit(orgId: string, userId: string, habitId: string) {
  const rows = await q<{ count: string }>(
    "WITH upd AS (UPDATE habits SET archived_at = $1 WHERE id = $2 AND org_id = $3 AND user_id = $4 RETURNING 1) SELECT COUNT(*)::text as count FROM upd",
    [nowIso(), habitId, orgId, userId],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

/** Analytics */
export async function summaryForUser(params: { orgId: string; userId: string; days?: number }) {
  const days = Math.max(7, Math.min(params.days ?? 30, 365));
  const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const byDay = await q<any>(
    `SELECT day_key,
            AVG(mood)::float as mood_avg,
            AVG(energy)::float as energy_avg,
            AVG(stress)::float as stress_avg,
            COUNT(*)::int as count
     FROM checkins
     WHERE org_id = $1 AND user_id = $2 AND day_key >= $3
     GROUP BY day_key
     ORDER BY day_key ASC`,
    [params.orgId, params.userId, since],
  );

  const set = new Set(byDay.map((r: any) => r.day_key));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (set.has(day)) streak += 1;
    else break;
  }

  const overallRows = await q<any>(
    `SELECT AVG(mood)::float as mood_avg,
            AVG(energy)::float as energy_avg,
            AVG(stress)::float as stress_avg,
            COUNT(*)::int as total
     FROM checkins
     WHERE org_id = $1 AND user_id = $2`,
    [params.orgId, params.userId],
  );
  const overall = overallRows[0] || {};

  const today = new Date().toISOString().slice(0, 10);

  return {
    days,
    streak,
    today,
    overall: {
      moodAvg: overall.mood_avg ?? null,
      energyAvg: overall.energy_avg ?? null,
      stressAvg: overall.stress_avg ?? null,
      total: overall.total ?? 0,
    },
    byDay: byDay.map((r: any) => ({
      dayKey: r.day_key,
      moodAvg: r.mood_avg,
      energyAvg: r.energy_avg,
      stressAvg: r.stress_avg,
      count: r.count,
    })),
  };
}

/** Org-level analytics (admin/manager) */
export async function orgSummary(params: { orgId: string; days?: number }) {
  const days = Math.max(7, Math.min(params.days ?? 30, 365));
  const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const byDay = await q<any>(
    `SELECT day_key,
            AVG(mood)::float as mood_avg,
            AVG(energy)::float as energy_avg,
            AVG(stress)::float as stress_avg,
            COUNT(*)::int as checkins,
            COUNT(DISTINCT user_id)::int as users
     FROM checkins
     WHERE org_id = $1 AND day_key >= $2
     GROUP BY day_key
     ORDER BY day_key ASC`,
    [params.orgId, since],
  );

  const overallRows = await q<any>(
    `SELECT AVG(mood)::float as mood_avg,
            AVG(energy)::float as energy_avg,
            AVG(stress)::float as stress_avg,
            COUNT(*)::int as checkins,
            COUNT(DISTINCT user_id)::int as users
     FROM checkins
     WHERE org_id = $1`,
    [params.orgId],
  );
  const overall = overallRows[0] || {};

  const last7Since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const riskRows = await q<any>(
    `SELECT user_id,
            AVG(mood)::float as mood_avg,
            AVG(stress)::float as stress_avg,
            COUNT(*)::int as count
     FROM checkins
     WHERE org_id = $1 AND day_key >= $2
     GROUP BY user_id
     HAVING COUNT(*) >= 3 AND (AVG(mood) <= 4.5 OR AVG(stress) >= 7.5)
     ORDER BY AVG(stress) DESC`,
    [params.orgId, last7Since],
  );

  const users = await q<any>("SELECT id, username FROM users WHERE org_id = $1", [params.orgId]);
  const userMap = new Map<string, string>();
  for (const u of users) userMap.set(u.id, u.username);

  return {
    days,
    overall: {
      moodAvg: overall.mood_avg ?? null,
      energyAvg: overall.energy_avg ?? null,
      stressAvg: overall.stress_avg ?? null,
      checkins: overall.checkins ?? 0,
      users: overall.users ?? 0,
    },
    byDay: byDay.map((r: any) => ({
      dayKey: r.day_key,
      moodAvg: r.mood_avg,
      energyAvg: r.energy_avg,
      stressAvg: r.stress_avg,
      checkins: r.checkins,
      users: r.users,
    })),
    risk: riskRows.map((r: any) => ({
      userId: r.user_id,
      username: userMap.get(r.user_id) || r.user_id,
      moodAvg: r.mood_avg,
      stressAvg: r.stress_avg,
      count: r.count,
    })),
  };
}

/** ✅ Confessional (Private Journal) — Option A */
export async function createConfessionalEntry(params: { orgId: string; userId: string; content: string; tags?: string[] }) {
  const createdAt = nowIso();
  const tags = normalizeTags(params.tags ?? []);
  const content = String(params.content ?? "").trim();
  if (!content) throw new Error("Confessional entry content is required");

  const row = {
    id: nanoid(),
    orgId: params.orgId,
    userId: params.userId,
    content,
    tags,
    tagsJson: JSON.stringify(tags),
    createdAt,
  };

  await q(
    `INSERT INTO confessional_entries (id, org_id, user_id, content, tags_json, created_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [row.id, row.orgId, row.userId, row.content, row.tags, row.createdAt],
  );

  return row;
}

export async function listConfessionalEntries(params: { orgId: string; userId: string; limit?: number }) {
  const limit = Math.max(1, Math.min(params.limit ?? 50, 200));

  const rows = await q<any>(
    `SELECT * FROM confessional_entries
     WHERE org_id = $1 AND user_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [params.orgId, params.userId, limit],
  );

  return rows.map((r) => {
    const tags = readJsonbArray(r.tags_json);
    return {
      id: r.id,
      orgId: r.org_id,
      userId: r.user_id,
      content: r.content,
      tags,
      tagsJson: JSON.stringify(tags),
      createdAt: r.created_at,
    };
  });
}

export async function deleteConfessionalEntry(orgId: string, userId: string, entryId: string) {
  const rows = await q<{ count: string }>(
    "WITH del AS (DELETE FROM confessional_entries WHERE id = $1 AND org_id = $2 AND user_id = $3 RETURNING 1) SELECT COUNT(*)::text as count FROM del",
    [entryId, orgId, userId],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

/** Outlet analytics (manager/admin) */
export async function outletAnalyticsSummary(params: { orgId: string; days?: number }) {
  const days = Math.max(7, Math.min(params.days ?? 30, 365));
  const sinceIso = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString();

  // Only summarize real “outlet” sessions (not confessional kind)
  const totalsRows = await q<any>(
    `
    SELECT
      COUNT(*)::int as sessions_total,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END)::int as sessions_open,
      SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END)::int as sessions_escalated,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END)::int as sessions_closed,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END)::int as sessions_resolved,
      AVG(risk_level)::float as risk_avg
    FROM outlet_sessions
    WHERE org_id = $1 AND created_at >= $2 AND kind = 'outlet'
    `,
    [params.orgId, sinceIso],
  );
  const totals = totalsRows[0] || {};

  const byCategory = await q<any>(
    `
    SELECT
      COALESCE(NULLIF(TRIM(category), ''), 'uncategorized') as category,
      COUNT(*)::int as sessions,
      AVG(risk_level)::float as risk_avg,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END)::int as open,
      SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END)::int as escalated,
      SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END)::int as closed,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END)::int as resolved
    FROM outlet_sessions
    WHERE org_id = $1 AND created_at >= $2 AND kind = 'outlet'
    GROUP BY 1
    ORDER BY sessions DESC
    `,
    [params.orgId, sinceIso],
  );

  const byDay = await q<any>(
    `
    SELECT
      SUBSTRING(created_at, 1, 10) as day_key,
      COUNT(*)::int as sessions,
      AVG(risk_level)::float as risk_avg
    FROM outlet_sessions
    WHERE org_id = $1 AND created_at >= $2 AND kind = 'outlet'
    GROUP BY 1
    ORDER BY day_key ASC
    `,
    [params.orgId, sinceIso],
  );

  const riskTop = await q<any>(
    `
    SELECT
      s.id as session_id,
      s.user_id,
      u.username,
      s.status,
      s.visibility,
      s.category,
      s.risk_level,
      s.last_message_at,
      s.created_at,
      s.updated_at
    FROM outlet_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.org_id = $1 AND s.created_at >= $2 AND s.kind = 'outlet'
    ORDER BY s.risk_level DESC, s.updated_at DESC
    LIMIT 15
    `,
    [params.orgId, sinceIso],
  );

  return {
    days,
    totals: {
      sessionsTotal: totals.sessions_total ?? 0,
      open: totals.sessions_open ?? 0,
      escalated: totals.sessions_escalated ?? 0,
      closed: totals.sessions_closed ?? 0,
      resolved: totals.sessions_resolved ?? 0,
      riskAvg: totals.risk_avg ?? null,
    },
    byCategory: (byCategory || []).map((r: any) => ({
      category: r.category,
      sessions: r.sessions,
      riskAvg: r.risk_avg ?? null,
      open: r.open,
      escalated: r.escalated,
      closed: r.closed,
      resolved: r.resolved,
    })),
    byDay: (byDay || []).map((r: any) => ({
      dayKey: r.day_key,
      sessions: r.sessions,
      riskAvg: r.risk_avg ?? null,
    })),
    riskTop: (riskTop || []).map((r: any) => ({
      sessionId: r.session_id,
      userId: r.user_id,
      username: r.username,
      status: normalizeStatus(r.status),
      visibility: normalizeVisibility(r.visibility),
      category: r.category ?? null,
      riskLevel: r.risk_level ?? 0,
      lastMessageAt: r.last_message_at ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  };
}

/** Invites */
export async function createInvite(params: { orgId: string; role: Role; expiresAt: string; createdBy: string }) {
  const token = nanoid(32);
  const invite = {
    token,
    orgId: params.orgId,
    role: params.role,
    expiresAt: params.expiresAt,
    createdAt: nowIso(),
    createdBy: params.createdBy,
  };

  await q("INSERT INTO invites (token, org_id, role, expires_at, created_at, created_by) VALUES ($1,$2,$3,$4,$5,$6)", [
    invite.token,
    invite.orgId,
    invite.role,
    invite.expiresAt,
    invite.createdAt,
    invite.createdBy,
  ]);

  return invite;
}

export async function getInvite(token: string) {
  const rows = await q<any>("SELECT * FROM invites WHERE token = $1", [token]);
  const row = rows[0];
  if (!row) return null;
  return {
    token: row.token,
    orgId: row.org_id,
    role: row.role as Role,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export async function deleteInvite(token: string) {
  const rows = await q<{ count: string }>(
    "WITH del AS (DELETE FROM invites WHERE token = $1 RETURNING 1) SELECT COUNT(*)::text as count FROM del",
    [token],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

/** Password resets */
export async function createPasswordReset(params: { orgId: string; userId: string; expiresAt: string; createdBy: string }) {
  const token = nanoid(40);
  const reset = {
    token,
    orgId: params.orgId,
    userId: params.userId,
    expiresAt: params.expiresAt,
    createdAt: nowIso(),
    createdBy: params.createdBy,
  };

  await q(
    "INSERT INTO password_resets (token, user_id, org_id, expires_at, created_at, created_by) VALUES ($1,$2,$3,$4,$5,$6)",
    [reset.token, reset.userId, reset.orgId, reset.expiresAt, reset.createdAt, reset.createdBy],
  );

  return reset;
}

export async function getPasswordReset(token: string) {
  const rows = await q<any>("SELECT * FROM password_resets WHERE token = $1", [token]);
  const row = rows[0];
  if (!row) return null;
  return {
    token: row.token,
    userId: row.user_id,
    orgId: row.org_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export async function deletePasswordReset(token: string) {
  const rows = await q<{ count: string }>(
    "WITH del AS (DELETE FROM password_resets WHERE token = $1 RETURNING 1) SELECT COUNT(*)::text as count FROM del",
    [token],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

export async function setUserPassword(userId: string, password: string) {
  const passwordHash = hashPassword(password);
  const rows = await q<{ count: string }>(
    "WITH upd AS (UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING 1) SELECT COUNT(*)::text as count FROM upd",
    [passwordHash, userId],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

/** Profiles */
export async function getUserProfile(orgId: string, userId: string) {
  const rows = await q<any>("SELECT * FROM user_profiles WHERE org_id = $1 AND user_id = $2", [orgId, userId]);
  const row = rows[0];

  if (!row) {
    const now = nowIso();
    await q(
      `INSERT INTO user_profiles (user_id, org_id, full_name, email, phone, tags_json, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, orgId, null, null, null, [], now, now],
    );
    return {
      userId,
      orgId,
      fullName: null,
      email: null,
      phone: null,
      tagsJson: "[]",
      createdAt: now,
      updatedAt: now,
    };
  }

  const tags = readJsonbArray(row.tags_json);
  return {
    userId: row.user_id,
    orgId: row.org_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    tagsJson: JSON.stringify(tags),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertUserProfile(params: {
  orgId: string;
  userId: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  tags?: string[];
}) {
  const existing = await getUserProfile(params.orgId, params.userId);
  const now = nowIso();

  const existingTags = (() => {
    try {
      return JSON.parse(existing.tagsJson || "[]");
    } catch {
      return [];
    }
  })();

  const nextFullName = params.fullName ?? (existing as any).fullName ?? null;
  const nextEmail = params.email ?? (existing as any).email ?? null;
  const nextPhone = params.phone ?? (existing as any).phone ?? null;
  const nextTags = normalizeTags(params.tags ?? existingTags);

  await q(
    `UPDATE user_profiles
     SET full_name = $1, email = $2, phone = $3, tags_json = $4, updated_at = $5
     WHERE org_id = $6 AND user_id = $7`,
    [nextFullName, nextEmail, nextPhone, nextTags, now, params.orgId, params.userId],
  );

  return getUserProfile(params.orgId, params.userId);
}

/** Notes */
export async function addUserNote(params: { orgId: string; userId: string; authorId: string; note: string; ts?: string }) {
  const row = {
    id: nanoid(),
    orgId: params.orgId,
    userId: params.userId,
    authorId: params.authorId,
    ts: params.ts || nowIso(),
    note: params.note.trim(),
    createdAt: nowIso(),
  };

  await q("INSERT INTO user_notes (id, org_id, user_id, author_id, ts, note, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)", [
    row.id,
    row.orgId,
    row.userId,
    row.authorId,
    row.ts,
    row.note,
    row.createdAt,
  ]);

  return row;
}

export async function listUserNotes(params: { orgId: string; userId: string; limit?: number }) {
  const limit = Math.max(1, Math.min(params.limit ?? 100, 500));

  const rows = await q<any>("SELECT * FROM user_notes WHERE org_id = $1 AND user_id = $2 ORDER BY ts DESC LIMIT $3", [
    params.orgId,
    params.userId,
    limit,
  ]);

  const au = await q<any>("SELECT id, username FROM users WHERE org_id = $1", [params.orgId]);
  const authors = new Map<string, string>();
  for (const a of au) authors.set(a.id, a.username);

  return rows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    userId: r.user_id,
    authorId: r.author_id,
    authorUsername: authors.get(r.author_id) || r.author_id,
    ts: r.ts,
    note: r.note,
    createdAt: r.created_at,
  }));
}

/** Outlet / grievance storage functions */
export async function createOutletSession(params: {
  orgId: string;
  userId: string;
  category?: string | null;
  visibility?: OutletVisibility;
  riskLevel?: number;
  kind?: OutletKind; // ✅ Option B
}) {
  const now = nowIso();

  const kind = (params.kind ?? "outlet") as OutletKind;

  // ✅ Confessional sessions are always private and never staff-visible
  const effectiveVisibility: OutletVisibility = kind === "confessional" ? "private" : (params.visibility ?? "private");

  const row = {
    id: nanoid(),
    orgId: params.orgId,
    userId: params.userId,
    kind,
    visibility: effectiveVisibility,
    category: (params.category ?? null)?.trim?.() ?? params.category ?? null,
    status: "open" as OutletStatus,
    riskLevel: toInt(params.riskLevel, 0),
    lastMessageAt: now,
    lastSender: "user" as OutletSender,
    messageCount: 0,
    resolutionNote: null as string | null,
    resolvedByUserId: null as string | null,
    resolvedAt: null as string | null,
    createdAt: now,
    updatedAt: now,
  };

  await q(
    `INSERT INTO outlet_sessions (
        id, org_id, user_id, kind, visibility, category, status, risk_level,
        last_message_at, last_sender, message_count,
        resolution_note, resolved_by_user_id, resolved_at,
        created_at, updated_at
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [
      row.id,
      row.orgId,
      row.userId,
      row.kind,
      row.visibility,
      row.category,
      row.status,
      row.riskLevel,
      row.lastMessageAt,
      row.lastSender,
      row.messageCount,
      row.resolutionNote,
      row.resolvedByUserId,
      row.resolvedAt,
      row.createdAt,
      row.updatedAt,
    ],
  );

  return row;
}

export async function getOutletSession(params: { orgId: string; sessionId: string }) {
  const rows = await q<any>("SELECT * FROM outlet_sessions WHERE org_id = $1 AND id = $2", [
    params.orgId,
    params.sessionId,
  ]);
  const r = rows[0];
  if (!r) return null;

  return {
    id: r.id,
    orgId: r.org_id,
    userId: r.user_id,
    kind: normalizeKind(r.kind),
    visibility: normalizeVisibility(r.visibility),
    category: r.category ?? null,
    status: normalizeStatus(r.status),
    riskLevel: r.risk_level ?? 0,
    lastMessageAt: r.last_message_at ?? null,
    lastSender: r.last_sender ? normalizeSender(r.last_sender) : null,
    messageCount: r.message_count ?? 0,
    resolutionNote: r.resolution_note ?? null,
    resolvedByUserId: r.resolved_by_user_id ?? null,
    resolvedAt: r.resolved_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listOutletSessionsForUser(params: { orgId: string; userId: string; limit?: number }) {
  const limit = Math.max(1, Math.min(params.limit ?? 50, 200));
  const rows = await q<any>(
    `SELECT * FROM outlet_sessions
     WHERE org_id = $1 AND user_id = $2
     ORDER BY updated_at DESC
     LIMIT $3`,
    [params.orgId, params.userId, limit],
  );

  return rows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    userId: r.user_id,
    kind: normalizeKind(r.kind),
    visibility: normalizeVisibility(r.visibility),
    category: r.category ?? null,
    status: normalizeStatus(r.status),
    riskLevel: r.risk_level ?? 0,
    lastMessageAt: r.last_message_at ?? null,
    lastSender: r.last_sender ? normalizeSender(r.last_sender) : null,
    messageCount: r.message_count ?? 0,
    resolutionNote: r.resolution_note ?? null,
    resolvedByUserId: r.resolved_by_user_id ?? null,
    resolvedAt: r.resolved_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function listOutletSessionsForStaff(params: { orgId: string; role: Role; staffUserId?: string; limit?: number }) {
  const limit = Math.max(1, Math.min(params.limit ?? 100, 300));
  if (params.role !== "manager" && params.role !== "admin") return [];

  // ✅ Staff NEVER sees confessional kind
  const onlyOutletKind = `s.kind = 'outlet'`;

  const visibilityClause =
    params.role === "admin" ? `(s.visibility = 'admin' OR s.visibility = 'manager')` : `(s.visibility = 'manager')`;

  const escRole = params.role;
  const escWhere: string[] = [`e.org_id = $1`, `e.escalated_to_role = $2`];
  const escArgs: any[] = [params.orgId, escRole];
  let i = 3;

  if (params.staffUserId) {
    escWhere.push(`(e.assigned_to_user_id IS NULL OR e.assigned_to_user_id = $${i++})`);
    escArgs.push(params.staffUserId);
  }

  const rows = await q<any>(
    `
    SELECT s.*
    FROM outlet_sessions s
    WHERE s.org_id = $1
      AND ${onlyOutletKind}
      AND (
        ${visibilityClause}
        OR s.id IN (
          SELECT e.session_id
          FROM outlet_escalations e
          WHERE ${escWhere.join(" AND ")}
        )
      )
    ORDER BY
      COALESCE(s.last_message_at, s.updated_at) DESC,
      s.risk_level DESC,
      s.updated_at DESC
    LIMIT $${i}
    `,
    [...escArgs, limit],
  );

  return rows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    userId: r.user_id,
    kind: normalizeKind(r.kind),
    visibility: normalizeVisibility(r.visibility),
    category: r.category ?? null,
    status: normalizeStatus(r.status),
    riskLevel: r.risk_level ?? 0,
    lastMessageAt: r.last_message_at ?? null,
    lastSender: r.last_sender ? normalizeSender(r.last_sender) : null,
    messageCount: r.message_count ?? 0,
    resolutionNote: r.resolution_note ?? null,
    resolvedByUserId: r.resolved_by_user_id ?? null,
    resolvedAt: r.resolved_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function listOutletMessages(params: { orgId: string; sessionId: string }) {
  const rows = await q<any>(
    `SELECT * FROM outlet_messages
     WHERE org_id = $1 AND session_id = $2
     ORDER BY created_at ASC`,
    [params.orgId, params.sessionId],
  );

  return rows.map((r) => ({
    id: r.id,
    orgId: r.org_id,
    sessionId: r.session_id,
    sender: normalizeSender(r.sender),
    content: r.content,
    createdAt: r.created_at,
  }));
}

export async function addOutletMessage(params: { orgId: string; sessionId: string; sender: OutletSender; content: string }) {
  const msg = {
    id: nanoid(),
    orgId: params.orgId,
    sessionId: params.sessionId,
    sender: params.sender,
    content: params.content.trim(),
    createdAt: nowIso(),
  };

  await q(
    `INSERT INTO outlet_messages (id, org_id, session_id, sender, content, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
    [msg.id, msg.orgId, msg.sessionId, msg.sender, msg.content, msg.createdAt],
  );

  await q(
    `UPDATE outlet_sessions
     SET
       updated_at = $1,
       last_message_at = $1,
       last_sender = $2,
       message_count = COALESCE(message_count, 0) + 1
     WHERE org_id = $3 AND id = $4`,
    [msg.createdAt, msg.sender, msg.orgId, msg.sessionId],
  );

  return msg;
}

export async function escalateOutletSession(params: {
  orgId: string;
  sessionId: string;
  escalatedToRole: "manager" | "admin";
  assignedToUserId?: string | null;
  reason?: string | null;
}) {
  const now = nowIso();

  // ✅ prevent escalation of confessional kind
  const sess = await getOutletSession({ orgId: params.orgId, sessionId: params.sessionId });
  if (!sess) throw new Error("Session not found");
  if (sess.kind === "confessional") throw new Error("Confessional sessions cannot be escalated");

  const esc = {
    id: nanoid(),
    orgId: params.orgId,
    sessionId: params.sessionId,
    escalatedToRole: params.escalatedToRole,
    assignedToUserId: params.assignedToUserId ?? null,
    reason: (params.reason ?? null)?.trim?.() ?? params.reason ?? null,
    createdAt: now,
  };

  await q(
    `INSERT INTO outlet_escalations (id, org_id, session_id, escalated_to_role, assigned_to_user_id, reason, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [esc.id, esc.orgId, esc.sessionId, esc.escalatedToRole, esc.assignedToUserId, esc.reason, esc.createdAt],
  );

  await q(`UPDATE outlet_sessions SET status = 'escalated', updated_at = $1 WHERE org_id = $2 AND id = $3`, [
    now,
    params.orgId,
    params.sessionId,
  ]);

  return esc;
}

export async function closeOutletSession(params: { orgId: string; sessionId: string }) {
  const now = nowIso();
  const rows = await q<{ count: string }>(
    "WITH upd AS (UPDATE outlet_sessions SET status = 'closed', updated_at = $1 WHERE org_id = $2 AND id = $3 RETURNING 1) SELECT COUNT(*)::text as count FROM upd",
    [now, params.orgId, params.sessionId],
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

export async function resolveOutletSession(params: {
  orgId: string;
  sessionId: string;
  resolvedByUserId: string;
  resolutionNote?: string | null;
}) {
  const now = nowIso();
  const note = (params.resolutionNote ?? null)?.trim?.() ?? params.resolutionNote ?? null;

  // ✅ resolve only for outlet kind
  const sess = await getOutletSession({ orgId: params.orgId, sessionId: params.sessionId });
  if (!sess) throw new Error("Session not found");
  if (sess.kind === "confessional") throw new Error("Confessional sessions cannot be resolved by staff");

  const rows = await q<{ count: string }>(
    `
    WITH upd AS (
      UPDATE outlet_sessions
      SET
        status = 'resolved',
        resolution_note = $1,
        resolved_by_user_id = $2,
        resolved_at = $3,
        updated_at = $3
      WHERE org_id = $4 AND id = $5
      RETURNING 1
    )
    SELECT COUNT(*)::text as count FROM upd
    `,
    [note, params.resolvedByUserId, now, params.orgId, params.sessionId],
  );

  return Number(rows[0]?.count ?? 0) > 0;
}

/** Export helpers */
function csvEscape(v: any) {
  const s = (v ?? "").toString();
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export async function exportCheckinsCsv(params: { orgId: string; userId?: string; sinceDayKey?: string }) {
  const where: string[] = ["c.org_id = $1"];
  const args: any[] = [params.orgId];
  let i = 2;

  if (params.userId) {
    where.push(`c.user_id = $${i++}`);
    args.push(params.userId);
  }
  if (params.sinceDayKey) {
    where.push(`c.day_key >= $${i++}`);
    args.push(params.sinceDayKey);
  }

  const sql = `SELECT c.*, u.username
               FROM checkins c
               JOIN users u ON u.id = c.user_id
               WHERE ${where.join(" AND ")}
               ORDER BY c.ts ASC`;

  const rows = await q<any>(sql, args);

  const headers = ["id", "username", "userId", "ts", "dayKey", "mood", "energy", "stress", "note", "tags", "createdAt"];
  const lines = [headers.join(",")];

  for (const r of rows) {
    const tags = readJsonbArray(r.tags_json);
    const line = [
      r.id,
      r.username,
      r.user_id,
      r.ts,
      r.day_key,
      r.mood,
      r.energy,
      r.stress,
      r.note ?? "",
      JSON.stringify(tags),
      r.created_at,
    ]
      .map(csvEscape)
      .join(",");
    lines.push(line);
  }

  return lines.join("\n");
}

export async function exportUsersCsv(params: { orgId: string }) {
  const rows = await q<any>(
    `SELECT u.id as user_id, u.username, u.role, u.created_at,
            p.full_name, p.email, p.phone, p.tags_json, p.updated_at
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id AND p.org_id = u.org_id
     WHERE u.org_id = $1
     ORDER BY u.created_at ASC`,
    [params.orgId],
  );

  const headers = ["userId", "username", "role", "createdAt", "fullName", "email", "phone", "profileTags", "profileUpdatedAt"];
  const lines = [headers.join(",")];

  for (const r of rows) {
    const tags = readJsonbArray(r.tags_json);
    const line = [
      r.user_id,
      r.username,
      r.role,
      r.created_at,
      r.full_name ?? "",
      r.email ?? "",
      r.phone ?? "",
      JSON.stringify(tags),
      r.updated_at ?? "",
    ]
      .map(csvEscape)
      .join(",");
    lines.push(line);
  }

  return lines.join("\n");
}
