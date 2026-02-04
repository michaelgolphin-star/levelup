console.log("🟢 ensureDb() FILE LOADED");
import Database from "better-sqlite3";
import path from "path";
import { nanoid } from "nanoid";
import { hashPassword } from "./auth.js";
import type { Role } from "./types.js";

const DB_FILE = process.env.SQLITE_FILE || path.resolve("server", "data.sqlite");

let db: Database.Database | null = null;

export function getDb() {
  if (!db) {
    db = new Database(DB_FILE);
    db.pragma("journal_mode = WAL");
  }
  return db;
}

export function ensureDb() {
  export async function ensureDb() {
  console.log("🟢 ensureDb() FUNCTION CALLED");
  // existing code below;
  const d = getDb();
  d.exec(`
    CREATE TABLE IF NOT EXISTS orgs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      org_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (org_id) REFERENCES orgs(id)
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      ts TEXT NOT NULL,
      day_key TEXT NOT NULL,
      mood INTEGER NOT NULL,
      energy INTEGER NOT NULL,
      stress INTEGER NOT NULL,
      note TEXT,
      tags_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (org_id) REFERENCES orgs(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_checkins_org_day ON checkins(org_id, day_key);
    CREATE INDEX IF NOT EXISTS idx_checkins_user_day ON checkins(user_id, day_key);
    CREATE INDEX IF NOT EXISTS idx_checkins_user_ts ON checkins(user_id, ts);

    CREATE TABLE IF NOT EXISTS habits (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      target_per_week INTEGER NOT NULL,
      archived_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (org_id) REFERENCES orgs(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id, archived_at);

CREATE TABLE IF NOT EXISTS invites (
  token TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  role TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  FOREIGN KEY (org_id) REFERENCES orgs(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_invites_org ON invites(org_id, expires_at);

CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (org_id) REFERENCES orgs(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_pwreset_user ON password_resets(user_id, expires_at);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  tags_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (org_id) REFERENCES orgs(id)
);

CREATE INDEX IF NOT EXISTS idx_profiles_org ON user_profiles(org_id);

CREATE TABLE IF NOT EXISTS user_notes (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  ts TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (org_id) REFERENCES orgs(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON user_notes(org_id, user_id, ts);
  `);

  // Basic integrity: ensure roles are constrained by application; DB keeps TEXT.
}

export function nowIso() {
  return new Date().toISOString();
}

export function dayKeyFromIso(iso: string) {
  return iso.slice(0, 10);
}

/** Orgs */
export function createOrg(name: string) {
  const d = getDb();
  const org = { id: nanoid(), name, createdAt: nowIso() };
  d.prepare("INSERT INTO orgs (id, name, created_at) VALUES (?, ?, ?)").run(org.id, org.name, org.createdAt);
  return org;
}

export function getOrg(orgId: string) {
  const d = getDb();
  const row = d.prepare("SELECT id, name, created_at FROM orgs WHERE id = ?").get(orgId) as any;
  if (!row) return null;
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

/** Users */
export function createUser(params: { username: string; password: string; orgId: string; role: Role }) {
  const d = getDb();
  const user = {
    id: nanoid(),
    username: params.username.trim().toLowerCase(),
    passwordHash: hashPassword(params.password),
    orgId: params.orgId,
    role: params.role,
    createdAt: nowIso()
  };
  d.prepare(
    "INSERT INTO users (id, username, password_hash, org_id, role, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(user.id, user.username, user.passwordHash, user.orgId, user.role, user.createdAt);
  return user;
}

export function findUserByUsername(username: string) {
  const d = getDb();
  const row = d.prepare("SELECT * FROM users WHERE username = ?").get(username.trim().toLowerCase()) as any;
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    orgId: row.org_id,
    role: row.role,
    createdAt: row.created_at
  };
}

export function getUserById(userId: string) {
  const d = getDb();
  const row = d.prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    orgId: row.org_id,
    role: row.role,
    createdAt: row.created_at
  };
}

export function listUsers(orgId: string) {
  const d = getDb();
  const rows = d.prepare("SELECT id, username, org_id, role, created_at FROM users WHERE org_id = ? ORDER BY created_at DESC").all(orgId) as any[];
  return rows.map(r => ({ id: r.id, username: r.username, orgId: r.org_id, role: r.role, createdAt: r.created_at }));
}

export function setUserRole(orgId: string, userId: string, role: Role) {
  const d = getDb();
  const info = d.prepare("UPDATE users SET role = ? WHERE id = ? AND org_id = ?").run(role, userId, orgId);
  return info.changes > 0;
}

/** Check-ins */
export function createCheckIn(params: {
  orgId: string;
  userId: string;
  ts?: string;
  mood: number;
  energy: number;
  stress: number;
  note?: string | null;
  tags?: string[];
}) {
  const d = getDb();
  const ts = params.ts || nowIso();
  const checkin = {
    id: nanoid(),
    orgId: params.orgId,
    userId: params.userId,
    ts,
    dayKey: dayKeyFromIso(ts),
    mood: params.mood,
    energy: params.energy,
    stress: params.stress,
    note: (params.note ?? null),
    tagsJson: JSON.stringify(params.tags ?? []),
    createdAt: nowIso()
  };
  d.prepare(
    `INSERT INTO checkins (id, org_id, user_id, ts, day_key, mood, energy, stress, note, tags_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    checkin.id, checkin.orgId, checkin.userId, checkin.ts, checkin.dayKey,
    checkin.mood, checkin.energy, checkin.stress, checkin.note, checkin.tagsJson, checkin.createdAt
  );
  return checkin;
}

export function listCheckIns(params: { orgId: string; userId?: string; dayKey?: string; limit?: number }) {
  const d = getDb();
  const limit = Math.max(1, Math.min(params.limit ?? 200, 500));

  let sql = "SELECT * FROM checkins WHERE org_id = ?";
  const args: any[] = [params.orgId];

  if (params.userId) {
    sql += " AND user_id = ?";
    args.push(params.userId);
  }
  if (params.dayKey) {
    sql += " AND day_key = ?";
    args.push(params.dayKey);
  }

  sql += " ORDER BY ts DESC LIMIT ?";
  args.push(limit);

  const rows = d.prepare(sql).all(...args) as any[];
  return rows.map(r => ({
    id: r.id,
    orgId: r.org_id,
    userId: r.user_id,
    ts: r.ts,
    dayKey: r.day_key,
    mood: r.mood,
    energy: r.energy,
    stress: r.stress,
    note: r.note,
    tagsJson: r.tags_json,
    createdAt: r.created_at
  }));
}

export function deleteCheckIn(orgId: string, userId: string, checkInId: string) {
  const d = getDb();
  const info = d.prepare("DELETE FROM checkins WHERE id = ? AND org_id = ? AND user_id = ?").run(checkInId, orgId, userId);
  return info.changes > 0;
}

/** Habits */
export function createHabit(params: { orgId: string; userId: string; name: string; targetPerWeek: number }) {
  const d = getDb();
  const habit = {
    id: nanoid(),
    orgId: params.orgId,
    userId: params.userId,
    name: params.name.trim(),
    targetPerWeek: params.targetPerWeek,
    createdAt: nowIso(),
    archivedAt: null as string | null
  };
  d.prepare(
    "INSERT INTO habits (id, org_id, user_id, name, target_per_week, archived_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(habit.id, habit.orgId, habit.userId, habit.name, habit.targetPerWeek, habit.archivedAt, habit.createdAt);
  return habit;
}

export function listHabits(params: { orgId: string; userId: string; includeArchived?: boolean }) {
  const d = getDb();
  const includeArchived = !!params.includeArchived;
  const rows = d.prepare(
    `SELECT * FROM habits WHERE org_id = ? AND user_id = ? ${includeArchived ? "" : "AND archived_at IS NULL"} ORDER BY created_at DESC`
  ).all(params.orgId, params.userId) as any[];
  return rows.map(r => ({
    id: r.id,
    orgId: r.org_id,
    userId: r.user_id,
    name: r.name,
    targetPerWeek: r.target_per_week,
    archivedAt: r.archived_at,
    createdAt: r.created_at
  }));
}

export function archiveHabit(orgId: string, userId: string, habitId: string) {
  const d = getDb();
  const info = d.prepare("UPDATE habits SET archived_at = ? WHERE id = ? AND org_id = ? AND user_id = ?").run(nowIso(), habitId, orgId, userId);
  return info.changes > 0;
}

/** Analytics */
export function summaryForUser(params: { orgId: string; userId: string; days?: number }) {
  const d = getDb();
  const days = Math.max(7, Math.min(params.days ?? 30, 365));
  const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10); // dayKey min

  const rows = d.prepare(
    `SELECT day_key,
            AVG(mood) as mood_avg,
            AVG(energy) as energy_avg,
            AVG(stress) as stress_avg,
            COUNT(*) as count
     FROM checkins
     WHERE org_id = ? AND user_id = ? AND day_key >= ?
     GROUP BY day_key
     ORDER BY day_key ASC`
  ).all(params.orgId, params.userId, since) as any[];

  let streak = 0;
  // compute streak: consecutive days up to today with at least one check-in
  const set = new Set(rows.map(r => r.day_key));
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < 365; i++) {
    const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (set.has(day)) streak += 1;
    else break;
  }

  const overall = d.prepare(
    `SELECT AVG(mood) as mood_avg,
            AVG(energy) as energy_avg,
            AVG(stress) as stress_avg,
            COUNT(*) as total
     FROM checkins
     WHERE org_id = ? AND user_id = ?`
  ).get(params.orgId, params.userId) as any;

  return {
    days,
    streak,
    today,
    overall: {
      moodAvg: overall?.mood_avg ?? null,
      energyAvg: overall?.energy_avg ?? null,
      stressAvg: overall?.stress_avg ?? null,
      total: overall?.total ?? 0
    },
    byDay: rows.map(r => ({
      dayKey: r.day_key,
      moodAvg: r.mood_avg,
      energyAvg: r.energy_avg,
      stressAvg: r.stress_avg,
      count: r.count
    }))
  };
}

/** Org-level analytics for programs (admin/manager) */
export function orgSummary(params: { orgId: string; days?: number }) {
  const d = getDb();
  const days = Math.max(7, Math.min(params.days ?? 30, 365));
  const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Daily averages across org + unique check-ins count + unique users per day
  const byDay = d.prepare(
    `SELECT day_key,
            AVG(mood) as mood_avg,
            AVG(energy) as energy_avg,
            AVG(stress) as stress_avg,
            COUNT(*) as checkins,
            COUNT(DISTINCT user_id) as users
     FROM checkins
     WHERE org_id = ? AND day_key >= ?
     GROUP BY day_key
     ORDER BY day_key ASC`
  ).all(params.orgId, since) as any[];

  const overall = d.prepare(
    `SELECT AVG(mood) as mood_avg,
            AVG(energy) as energy_avg,
            AVG(stress) as stress_avg,
            COUNT(*) as checkins,
            COUNT(DISTINCT user_id) as users
     FROM checkins
     WHERE org_id = ?`
  ).get(params.orgId) as any;

  // Light risk signal: users with last 7 days avg mood <= 4.5 OR avg stress >= 7.5 and at least 3 checkins
  const riskRows = d.prepare(
    `SELECT user_id,
            AVG(mood) as mood_avg,
            AVG(stress) as stress_avg,
            COUNT(*) as count
     FROM checkins
     WHERE org_id = ? AND day_key >= ?
     GROUP BY user_id
     HAVING count >= 3 AND (mood_avg <= 4.5 OR stress_avg >= 7.5)
     ORDER BY stress_avg DESC`
  ).all(params.orgId, new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)) as any[];

  // Map user ids to usernames
  const userMap = new Map<string, string>();
  const users = d.prepare("SELECT id, username FROM users WHERE org_id = ?").all(params.orgId) as any[];
  for (const u of users) userMap.set(u.id, u.username);

  return {
    days,
    overall: {
      moodAvg: overall?.mood_avg ?? null,
      energyAvg: overall?.energy_avg ?? null,
      stressAvg: overall?.stress_avg ?? null,
      checkins: overall?.checkins ?? 0,
      users: overall?.users ?? 0
    },
    byDay: byDay.map(r => ({
      dayKey: r.day_key,
      moodAvg: r.mood_avg,
      energyAvg: r.energy_avg,
      stressAvg: r.stress_avg,
      checkins: r.checkins,
      users: r.users
    })),
    risk: riskRows.map(r => ({
      userId: r.user_id,
      username: userMap.get(r.user_id) || r.user_id,
      moodAvg: r.mood_avg,
      stressAvg: r.stress_avg,
      count: r.count
    }))
  };
}

/** Invites (shareable links) */
export function createInvite(params: { orgId: string; role: Role; expiresAt: string; createdBy: string }) {
  const d = getDb();
  const token = nanoid(32);
  const invite = {
    token,
    orgId: params.orgId,
    role: params.role,
    expiresAt: params.expiresAt,
    createdAt: nowIso(),
    createdBy: params.createdBy
  };
  d.prepare("INSERT INTO invites (token, org_id, role, expires_at, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)")
    .run(invite.token, invite.orgId, invite.role, invite.expiresAt, invite.createdAt, invite.createdBy);
  return invite;
}

export function getInvite(token: string) {
  const d = getDb();
  const row = d.prepare("SELECT * FROM invites WHERE token = ?").get(token) as any;
  if (!row) return null;
  return {
    token: row.token,
    orgId: row.org_id,
    role: row.role as Role,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    createdBy: row.created_by
  };
}

export function deleteInvite(token: string) {
  const d = getDb();
  const info = d.prepare("DELETE FROM invites WHERE token = ?").run(token);
  return info.changes > 0;
}

/** Password resets (demo-friendly; token returned directly) */
export function createPasswordReset(params: { orgId: string; userId: string; expiresAt: string; createdBy: string }) {
  const d = getDb();
  const token = nanoid(40);
  const reset = {
    token,
    orgId: params.orgId,
    userId: params.userId,
    expiresAt: params.expiresAt,
    createdAt: nowIso(),
    createdBy: params.createdBy
  };
  d.prepare("INSERT INTO password_resets (token, user_id, org_id, expires_at, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)")
    .run(reset.token, reset.userId, reset.orgId, reset.expiresAt, reset.createdAt, reset.createdBy);
  return reset;
}

export function getPasswordReset(token: string) {
  const d = getDb();
  const row = d.prepare("SELECT * FROM password_resets WHERE token = ?").get(token) as any;
  if (!row) return null;
  return {
    token: row.token,
    userId: row.user_id,
    orgId: row.org_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    createdBy: row.created_by
  };
}

export function deletePasswordReset(token: string) {
  const d = getDb();
  const info = d.prepare("DELETE FROM password_resets WHERE token = ?").run(token);
  return info.changes > 0;
}

export function setUserPassword(userId: string, password: string) {
  const d = getDb();
  const passwordHash = hashPassword(password);
  const info = d.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
  return info.changes > 0;
}

/** Profiles */
export function getUserProfile(orgId: string, userId: string) {
  const d = getDb();
  const row = d.prepare("SELECT * FROM user_profiles WHERE org_id = ? AND user_id = ?").get(orgId, userId) as any;
  if (!row) {
    // auto-create empty profile for convenience
    const now = nowIso();
    d.prepare("INSERT OR IGNORE INTO user_profiles (user_id, org_id, full_name, email, phone, tags_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(userId, orgId, null, null, null, "[]", now, now);
    return { userId, orgId, fullName: null, email: null, phone: null, tagsJson: "[]", createdAt: now, updatedAt: now };
  }
  return {
    userId: row.user_id,
    orgId: row.org_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    tagsJson: row.tags_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function upsertUserProfile(params: { orgId: string; userId: string; fullName?: string | null; email?: string | null; phone?: string | null; tags?: string[] }) {
  const d = getDb();
  const existing = getUserProfile(params.orgId, params.userId);
  const now = nowIso();
  const next = {
    fullName: (params.fullName ?? existing.fullName) ?? null,
    email: (params.email ?? existing.email) ?? null,
    phone: (params.phone ?? existing.phone) ?? null,
    tagsJson: JSON.stringify(params.tags ?? JSON.parse(existing.tagsJson || "[]")),
    updatedAt: now
  };
  d.prepare(
    `UPDATE user_profiles SET full_name = ?, email = ?, phone = ?, tags_json = ?, updated_at = ? WHERE org_id = ? AND user_id = ?`
  ).run(next.fullName, next.email, next.phone, next.tagsJson, next.updatedAt, params.orgId, params.userId);
  return getUserProfile(params.orgId, params.userId);
}

/** Notes (program staff) */
export function addUserNote(params: { orgId: string; userId: string; authorId: string; note: string; ts?: string }) {
  const d = getDb();
  const row = {
    id: nanoid(),
    orgId: params.orgId,
    userId: params.userId,
    authorId: params.authorId,
    ts: params.ts || nowIso(),
    note: params.note.trim(),
    createdAt: nowIso()
  };
  d.prepare("INSERT INTO user_notes (id, org_id, user_id, author_id, ts, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(row.id, row.orgId, row.userId, row.authorId, row.ts, row.note, row.createdAt);
  return row;
}

export function listUserNotes(params: { orgId: string; userId: string; limit?: number }) {
  const d = getDb();
  const limit = Math.max(1, Math.min(params.limit ?? 100, 500));
  const rows = d.prepare("SELECT * FROM user_notes WHERE org_id = ? AND user_id = ? ORDER BY ts DESC LIMIT ?")
    .all(params.orgId, params.userId, limit) as any[];
  // author username lookup
  const authors = new Map<string, string>();
  const au = d.prepare("SELECT id, username FROM users WHERE org_id = ?").all(params.orgId) as any[];
  for (const a of au) authors.set(a.id, a.username);

  return rows.map(r => ({
    id: r.id,
    orgId: r.org_id,
    userId: r.user_id,
    authorId: r.author_id,
    authorUsername: authors.get(r.author_id) || r.author_id,
    ts: r.ts,
    note: r.note,
    createdAt: r.created_at
  }));
}

/** Export helpers */
function csvEscape(v: any) {
  const s = (v ?? "").toString();
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function exportCheckinsCsv(params: { orgId: string; userId?: string; sinceDayKey?: string }) {
  const d = getDb();
  let sql = "SELECT c.*, u.username FROM checkins c JOIN users u ON u.id = c.user_id WHERE c.org_id = ?";
  const args: any[] = [params.orgId];
  if (params.userId) {
    sql += " AND c.user_id = ?";
    args.push(params.userId);
  }
  if (params.sinceDayKey) {
    sql += " AND c.day_key >= ?";
    args.push(params.sinceDayKey);
  }
  sql += " ORDER BY c.ts ASC";
  const rows = d.prepare(sql).all(...args) as any[];

  const headers = ["id","username","userId","ts","dayKey","mood","energy","stress","note","tags","createdAt"];
  const lines = [headers.join(",")];
  for (const r of rows) {
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
      r.tags_json ?? "[]",
      r.created_at
    ].map(csvEscape).join(",");
    lines.push(line);
  }
  return lines.join("\n");
}

export function exportUsersCsv(params: { orgId: string }) {
  const d = getDb();
  const rows = d.prepare(
    `SELECT u.id as user_id, u.username, u.role, u.created_at,
            p.full_name, p.email, p.phone, p.tags_json, p.updated_at
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id AND p.org_id = u.org_id
     WHERE u.org_id = ?
     ORDER BY u.created_at ASC`
  ).all(params.orgId) as any[];

  const headers = ["userId","username","role","createdAt","fullName","email","phone","profileTags","profileUpdatedAt"];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const line = [
      r.user_id,
      r.username,
      r.role,
      r.created_at,
      r.full_name ?? "",
      r.email ?? "",
      r.phone ?? "",
      r.tags_json ?? "[]",
      r.updated_at ?? ""
    ].map(csvEscape).join(",");
    lines.push(line);
  }
  return lines.join("\n");
}
