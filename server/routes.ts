import type { Express } from "express";
import { z } from "zod";
import {
  createOrg,
  createUser,
  findUserByUsername,
  getOrg,
  listUsers,
  setUserRole,
  createCheckIn,
  listCheckIns,
  deleteCheckIn,
  createHabit,
  listHabits,
  archiveHabit,
  summaryForUser,
  orgSummary,
  createInvite,
  getInvite,
  deleteInvite,
  createPasswordReset,
  getPasswordReset,
  deletePasswordReset,
  setUserPassword,
  getUserProfile,
  upsertUserProfile,
  addUserNote,
  listUserNotes,
  exportCheckinsCsv,
  exportUsersCsv,
} from "./storage.js";
import { requireAuth, requireRole, signToken, verifyPassword } from "./auth.js";

const RegisterSchema = z.object({
  orgName: z.string().min(2).max(80).optional(),
  username: z.string().min(3).max(40),
  password: z.string().min(6).max(200),
});

const LoginSchema = z.object({
  username: z.string().min(3).max(40),
  password: z.string().min(6).max(200),
});

const CheckInSchema = z.object({
  ts: z.string().datetime().optional(),
  mood: z.number().int().min(1).max(10),
  energy: z.number().int().min(1).max(10),
  stress: z.number().int().min(1).max(10),
  note: z.string().max(1000).optional().nullable(),
  tags: z.array(z.string().max(24)).max(20).optional(),
});

const HabitSchema = z.object({
  name: z.string().min(1).max(80),
  targetPerWeek: z.number().int().min(1).max(14),
});

export function registerRoutes(app: Express) {
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // -----------------------------
  // Auth
  // -----------------------------
  app.post("/api/auth/register", async (req, res) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { username, password } = parsed.data;
    const orgName = parsed.data.orgName?.trim() || "My Org";

    const existing = await findUserByUsername(username);
    if (existing) return res.status(409).json({ error: "Username already exists" });

    const org = await createOrg(orgName);
    const user = await createUser({ username, password, orgId: org.id, role: "admin" });

    const token = signToken({ userId: user.id, orgId: org.id, role: user.role });
    return res.json({
      token,
      user: { id: user.id, username: user.username, orgId: user.orgId, role: user.role },
      org,
    });
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { username, password } = parsed.data;
    const user = await findUserByUsername(username);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = verifyPassword(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const org = await getOrg(user.orgId);
    const token = signToken({ userId: user.id, orgId: user.orgId, role: user.role });
    return res.json({
      token,
      user: { id: user.id, username: user.username, orgId: user.orgId, role: user.role },
      org,
    });
  });

  // -----------------------------
  // Me
  // -----------------------------
  app.get("/api/me", requireAuth, (req, res) => {
    return res.json({ auth: (req as any).auth });
  });

  // -----------------------------
  // Org + Users
  // -----------------------------
  app.get("/api/org", requireAuth, async (req, res) => {
    const org = await getOrg((req as any).auth!.orgId);
    return res.json({ org });
  });

  app.get("/api/users", requireAuth, requireRole(["admin", "manager"]), async (req, res) => {
    const users = await listUsers((req as any).auth!.orgId);
    return res.json({ users });
  });

  app.post("/api/users/role", requireAuth, requireRole(["admin"]), async (req, res) => {
    const schema = z.object({ userId: z.string().min(3), role: z.enum(["user", "manager", "admin"]) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const ok = await setUserRole((req as any).auth!.orgId, parsed.data.userId, parsed.data.role);
    return res.json({ ok });
  });

  // Admin: create a user inside this org
  app.post("/api/admin/users", requireAuth, requireRole(["admin"]), async (req, res) => {
    const schema = z.object({
      username: z.string().min(3).max(40),
      password: z.string().min(6).max(200),
      role: z.enum(["user", "manager", "admin"]).default("user"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const existing = await findUserByUsername(parsed.data.username);
    if (existing) return res.status(409).json({ error: "Username already exists" });

    const user = await createUser({
      username: parsed.data.username,
      password: parsed.data.password,
      orgId: (req as any).auth!.orgId,
      role: parsed.data.role,
    });

    return res.json({ user: { id: user.id, username: user.username, orgId: user.orgId, role: user.role } });
  });

  // Admin: create an invite link (shareable)
  app.post("/api/admin/invites", requireAuth, requireRole(["admin"]), async (req, res) => {
    const schema = z.object({
      role: z.enum(["user", "manager", "admin"]).default("user"),
      expiresInDays: z.number().int().min(1).max(30).default(7),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000).toISOString();
    const invite = await createInvite({
      orgId: (req as any).auth!.orgId,
      role: parsed.data.role,
      expiresAt,
      createdBy: (req as any).auth!.userId,
    });
    return res.json({ invite, urlPath: `/invite/${invite.token}` });
  });

  // Public: validate invite token
  app.get("/api/invites/:token", async (req, res) => {
    const token = String(req.params.token || "");
    const invite = await getInvite(token);
    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (new Date(invite.expiresAt).getTime() < Date.now()) return res.status(410).json({ error: "Invite expired" });
    const org = await getOrg(invite.orgId);
    return res.json({ invite: { token: invite.token, role: invite.role, expiresAt: invite.expiresAt }, org });
  });

  // Public: accept invite (creates user in that org)
  app.post("/api/invites/:token/accept", async (req, res) => {
    const token = String(req.params.token || "");
    const invite = await getInvite(token);
    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (new Date(invite.expiresAt).getTime() < Date.now()) return res.status(410).json({ error: "Invite expired" });

    const schema = z.object({
      username: z.string().min(3).max(40),
      password: z.string().min(6).max(200),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const existing = await findUserByUsername(parsed.data.username);
    if (existing) return res.status(409).json({ error: "Username already exists" });

    const user = await createUser({
      username: parsed.data.username,
      password: parsed.data.password,
      orgId: invite.orgId,
      role: invite.role,
    });

    await deleteInvite(token);

    const org = await getOrg(invite.orgId);
    const jwt = signToken({ userId: user.id, orgId: user.orgId, role: user.role });
    return res.json({ token: jwt, user: { id: user.id, username: user.username, orgId: user.orgId, role: user.role }, org });
  });

  // Auth: request password reset (demo - returns token directly)
  app.post("/api/auth/request-reset", async (req, res) => {
    const schema = z.object({ username: z.string().min(3).max(40) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const user = await findUserByUsername(parsed.data.username);
    if (!user) return res.status(404).json({ error: "User not found" });

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    const reset = await createPasswordReset({ orgId: user.orgId, userId: user.id, expiresAt, createdBy: user.id });
    return res.json({ reset: { token: reset.token, expiresAt: reset.expiresAt } });
  });

  // Auth: reset password using token
  app.post("/api/auth/reset", async (req, res) => {
    const schema = z.object({ token: z.string().min(10), newPassword: z.string().min(6).max(200) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const reset = await getPasswordReset(parsed.data.token);
    if (!reset) return res.status(404).json({ error: "Reset token not found" });
    if (new Date(reset.expiresAt).getTime() < Date.now()) return res.status(410).json({ error: "Reset token expired" });

    await setUserPassword(reset.userId, parsed.data.newPassword);
    await deletePasswordReset(reset.token);
    return res.json({ ok: true });
  });

  // Admin: generate reset token for a user (returns token directly)
  app.post("/api/admin/users/:id/reset-token", requireAuth, requireRole(["admin"]), async (req, res) => {
    const userId = String(req.params.id || "");
    const schema = z.object({ expiresInMinutes: z.number().int().min(10).max(1440).default(60) });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const expiresAt = new Date(Date.now() + parsed.data.expiresInMinutes * 60 * 1000).toISOString();
    const reset = await createPasswordReset({
      orgId: (req as any).auth!.orgId,
      userId,
      expiresAt,
      createdBy: (req as any).auth!.userId,
    });
    return res.json({ reset: { token: reset.token, expiresAt: reset.expiresAt } });
  });

  // -----------------------------
  // Profiles
  // -----------------------------
  app.get("/api/users/:id/profile", requireAuth, async (req, res) => {
    const userId = String(req.params.id || "");
    const auth = (req as any).auth!;
    const isSelf = userId === auth.userId;
    const isStaff = auth.role === "admin" || auth.role === "manager";
    if (!isSelf && !isStaff) return res.status(403).json({ error: "Forbidden" });

    const profile = await getUserProfile(auth.orgId, userId);
    return res.json({ profile });
  });

  app.put("/api/users/:id/profile", requireAuth, async (req, res) => {
    const userId = String(req.params.id || "");
    const auth = (req as any).auth!;
    const isSelf = userId === auth.userId;
    const isStaff = auth.role === "admin" || auth.role === "manager";
    if (!isSelf && !isStaff) return res.status(403).json({ error: "Forbidden" });

    const schema = z.object({
      fullName: z.string().max(80).optional().nullable(),
      email: z.string().max(120).optional().nullable(),
      phone: z.string().max(40).optional().nullable(),
      tags: z.array(z.string().max(24)).max(30).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const profile = await upsertUserProfile({
      orgId: auth.orgId,
      userId,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      tags: parsed.data.tags,
    });
    return res.json({ profile });
  });

  // -----------------------------
  // Notes (staff only)
  // -----------------------------
  app.get("/api/users/:id/notes", requireAuth, requireRole(["admin", "manager"]), async (req, res) => {
    const userId = String(req.params.id || "");
    const schema = z.object({ limit: z.string().optional() });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const limit = parsed.data.limit ? Number(parsed.data.limit) : 100;
    const notes = await listUserNotes({ orgId: (req as any).auth!.orgId, userId, limit });
    return res.json({ notes });
  });

  app.post("/api/users/:id/notes", requireAuth, requireRole(["admin", "manager"]), async (req, res) => {
    const userId = String(req.params.id || "");
    const schema = z.object({ note: z.string().min(1).max(2000) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const n = await addUserNote({
      orgId: (req as any).auth!.orgId,
      userId,
      authorId: (req as any).auth!.userId,
      note: parsed.data.note,
    });
    return res.json({ note: n });
  });

  // -----------------------------
  // Exports (CSV): staff only
  // -----------------------------
  app.get("/api/export/checkins.csv", requireAuth, requireRole(["admin", "manager"]), async (req, res) => {
    const schema = z.object({ userId: z.string().optional(), sinceDays: z.string().optional() });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    let sinceDayKey: string | undefined = undefined;
    if (parsed.data.sinceDays) {
      const days = Math.max(1, Math.min(Number(parsed.data.sinceDays), 365));
      sinceDayKey = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }

    const csv = await exportCheckinsCsv({ orgId: (req as any).auth!.orgId, userId: parsed.data.userId, sinceDayKey });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"checkins.csv\"");
    return res.send(csv);
  });

  app.get("/api/export/users.csv", requireAuth, requireRole(["admin", "manager"]), async (req, res) => {
    const csv = await exportUsersCsv({ orgId: (req as any).auth!.orgId });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"users.csv\"");
    return res.send(csv);
  });

  // -----------------------------
  // Check-ins
  // -----------------------------
  app.post("/api/checkins", requireAuth, async (req, res) => {
    const parsed = CheckInSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const auth = (req as any).auth!;
    const checkin = await createCheckIn({
      orgId: auth.orgId,
      userId: auth.userId,
      ts: parsed.data.ts,
      mood: parsed.data.mood,
      energy: parsed.data.energy,
      stress: parsed.data.stress,
      note: parsed.data.note ?? null,
      tags: parsed.data.tags ?? [],
    });

    return res.json({ checkin });
  });

  app.get("/api/checkins", requireAuth, async (req, res) => {
    const schema = z.object({
      dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      limit: z.string().optional(),
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const auth = (req as any).auth!;
    const limit = parsed.data.limit ? Number(parsed.data.limit) : 200;
    const checkins = await listCheckIns({
      orgId: auth.orgId,
      userId: auth.userId,
      dayKey: parsed.data.dayKey,
      limit,
    });
    return res.json({ checkins });
  });

  app.delete("/api/checkins/:id", requireAuth, async (req, res) => {
    const id = String(req.params.id || "");
    const auth = (req as any).auth!;
    const ok = await deleteCheckIn(auth.orgId, auth.userId, id);
    return res.json({ ok });
  });

  // -----------------------------
  // Habits
  // -----------------------------
  app.post("/api/habits", requireAuth, async (req, res) => {
    const parsed = HabitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const auth = (req as any).auth!;
    const habit = await createHabit({
      orgId: auth.orgId,
      userId: auth.userId,
      name: parsed.data.name,
      targetPerWeek: parsed.data.targetPerWeek,
    });

    return res.json({ habit });
  });

  app.get("/api/habits", requireAuth, async (req, res) => {
    const schema = z.object({ includeArchived: z.string().optional() });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const auth = (req as any).auth!;
    const habits = await listHabits({
      orgId: auth.orgId,
      userId: auth.userId,
      includeArchived: parsed.data.includeArchived === "1",
    });

    return res.json({ habits });
  });

  app.post("/api/habits/:id/archive", requireAuth, async (req, res) => {
    const id = String(req.params.id || "");
    const auth = (req as any).auth!;
    const ok = await archiveHabit(auth.orgId, auth.userId, id);
    return res.json({ ok });
  });

  // -----------------------------
  // Analytics
  // -----------------------------
  app.get("/api/analytics/org-summary", requireAuth, requireRole(["admin", "manager"]), async (req, res) => {
    const schema = z.object({ days: z.string().optional() });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const days = parsed.data.days ? Number(parsed.data.days) : 30;
    const summary = await orgSummary({ orgId: (req as any).auth!.orgId, days });
    return res.json({ summary });
  });

  app.get("/api/analytics/summary", requireAuth, async (req, res) => {
    const schema = z.object({ days: z.string().optional() });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const auth = (req as any).auth!;
    const days = parsed.data.days ? Number(parsed.data.days) : 30;
    const summary = await summaryForUser({ orgId: auth.orgId, userId: auth.userId, days });
    return res.json({ summary });
  });
}
