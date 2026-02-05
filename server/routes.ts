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

  // Outlet / grievance
  createOutletSession,
  getOutletSession,
  listOutletSessionsForUser,
  listOutletSessionsForStaff,
  listOutletMessages,
  addOutletMessage,
  escalateOutletSession,
  closeOutletSession,
} from "./storage.js";
import { requireAuth, requireRole, signToken, verifyPassword } from "./auth.js";

/**
 * NOTE: AI is stubbed here on purpose.
 * Phase 2 Step 2 goal is to wire the workflow without forcing OpenAI integration yet.
 * Later you can replace `generateOutletAiReply()` with a real provider.
 */
async function generateOutletAiReply(params: {
  userMessage: string;
  category?: string | null;
  visibility?: string;
}): Promise<{ reply: string; riskLevel: number }> {
  const msg = params.userMessage.trim();

  // ultra-light “risk heuristic” (NOT diagnosis)
  const lowered = msg.toLowerCase();
  const riskKeywords = ["suicide", "kill myself", "self harm", "hurt myself", "gun", "shoot", "homicide", "kill them"];
  const riskLevel = riskKeywords.some((k) => lowered.includes(k)) ? 2 : 0;

  const reply =
    "I hear you. Thanks for sharing this.\n\n" +
    "A few quick questions to help you sort this out:\n" +
    "1) What happened (facts) and what impact did it have on you?\n" +
    "2) What would a reasonable outcome look like (schedule change, clarification, mediation, time off, boundaries, etc.)?\n" +
    "3) Is this urgent or safety-related?\n\n" +
    "If you want, I can help you: (a) write a clear message to your manager/HR, (b) document the situation, and (c) pick the best next step.";

  return { reply, riskLevel };
}

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

/** Outlet (grievance outlet) schemas */
const OutletCreateSchema = z.object({
  category: z.string().max(80).optional().nullable(),
  visibility: z.enum(["private", "manager", "admin"]).default("private"),
});

const OutletMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

const OutletEscalateSchema = z.object({
  escalatedToRole: z.enum(["manager", "admin"]),
  assignedToUserId: z.string().min(3).optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
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

  // Roster visibility (admin + manager)
  app.get("/api/users", requireAuth, requireRole(["admin", "manager"]), async (req, res) => {
    const users = await listUsers((req as any).auth!.orgId);
    return res.json({ users });
  });

  // Admin-only role changes
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
    return res.json({
      token: jwt,
      user: { id: user.id, username: user.username, orgId: user.orgId, role: user.role },
      org,
    });
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

    const limitRaw = parsed.data.limit ? Number(parsed.data.limit) : 100;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 500)) : 100;

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
  // Outlet / Grievance Office ✅
  // -----------------------------

  // Employee: create a new outlet session
  app.post("/api/outlet/sessions", requireAuth, async (req, res) => {
    const parsed = OutletCreateSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const auth = (req as any).auth!;
    const session = await createOutletSession({
      orgId: auth.orgId,
      userId: auth.userId,
      category: parsed.data.category ?? null,
      visibility: parsed.data.visibility,
      riskLevel: 0,
    });

    return res.json({ session });
  });

  // Employee: list my outlet sessions
  app.get("/api/outlet/sessions", requireAuth, async (req, res) => {
    const schema = z.object({ limit: z.string().optional() });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const auth = (req as any).auth!;
    const limitRaw = parsed.data.limit ? Number(parsed.data.limit) : 50;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 200)) : 50;

    // staff can request staff view via ?view=staff
    const view = String((req.query as any).view || "");
    if (view === "staff" && (auth.role === "admin" || auth.role === "manager")) {
      const sessions = await listOutletSessionsForStaff({
        orgId: auth.orgId,
        role: auth.role,
        staffUserId: auth.userId,
        limit: Math.max(limit, 100),
      });
      return res.json({ sessions });
    }

    const sessions = await listOutletSessionsForUser({ orgId: auth.orgId, userId: auth.userId, limit });
    return res.json({ sessions });
  });

  // Get a session + messages (RBAC enforced)
  app.get("/api/outlet/sessions/:id", requireAuth, async (req, res) => {
    const sessionId = String(req.params.id || "");
    const auth = (req as any).auth!;

    const session = await getOutletSession({ orgId: auth.orgId, sessionId });
    if (!session) return res.status(404).json({ error: "Session not found" });

    const isOwner = session.userId === auth.userId;
    const isStaff = auth.role === "admin" || auth.role === "manager";

    // Visibility rules:
    // - owner always allowed
    // - staff allowed if visibility permits OR it’s escalated for them (storage function handles in list view, but here we keep it simple)
    if (!isOwner) {
      if (!isStaff) return res.status(403).json({ error: "Forbidden" });

      const vis = String(session.visibility || "private");
      const staffAllowed =
        vis === "manager" ||
        (vis === "admin" && auth.role === "admin");

      if (!staffAllowed) return res.status(403).json({ error: "Forbidden" });
    }

    const messages = await listOutletMessages({ orgId: auth.orgId, sessionId });
    return res.json({ session, messages });
  });

  // Post a user message -> store -> generate AI reply -> store (owner only)
  app.post("/api/outlet/sessions/:id/messages", requireAuth, async (req, res) => {
    const sessionId = String(req.params.id || "");
    const parsed = OutletMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const auth = (req as any).auth!;
    const session = await getOutletSession({ orgId: auth.orgId, sessionId });
    if (!session) return res.status(404).json({ error: "Session not found" });

    if (session.userId !== auth.userId) return res.status(403).json({ error: "Forbidden" });

    const userMsg = await addOutletMessage({
      orgId: auth.orgId,
      sessionId,
      sender: "user",
      content: parsed.data.content,
    });

    const ai = await generateOutletAiReply({
      userMessage: parsed.data.content,
      category: session.category ?? null,
      visibility: session.visibility,
    });

    const aiMsg = await addOutletMessage({
      orgId: auth.orgId,
      sessionId,
      sender: "ai",
      content: ai.reply,
    });

    // If risk triggers, force visibility to admin via escalation (MVP behavior)
    if (ai.riskLevel >= 2) {
      await escalateOutletSession({
        orgId: auth.orgId,
        sessionId,
        escalatedToRole: "admin",
        assignedToUserId: null,
        reason: "Auto-flag: safety/risk keywords detected.",
      });
    }

    return res.json({ userMessage: userMsg, aiMessage: aiMsg, riskLevel: ai.riskLevel });
  });

  // Staff: escalate a session (manager/admin) — also allowed for owner if you want “please escalate”
  app.post("/api/outlet/sessions/:id/escalate", requireAuth, async (req, res) => {
    const sessionId = String(req.params.id || "");
    const parsed = OutletEscalateSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const auth = (req as any).auth!;
    const session = await getOutletSession({ orgId: auth.orgId, sessionId });
    if (!session) return res.status(404).json({ error: "Session not found" });

    const isOwner = session.userId === auth.userId;
    const isStaff = auth.role === "admin" || auth.role === "manager";

    // owner can request escalation upward (manager/admin). staff can escalate as well.
    if (!isOwner && !isStaff) return res.status(403).json({ error: "Forbidden" });

    // manager cannot escalate-to-admin? They can, but only admin can assign-to-user maybe later.
    if (auth.role === "manager" && parsed.data.escalatedToRole === "admin") {
      // allowed in MVP; change here if you want managers blocked from escalating to admin.
    }

    const esc = await escalateOutletSession({
      orgId: auth.orgId,
      sessionId,
      escalatedToRole: parsed.data.escalatedToRole,
      assignedToUserId: parsed.data.assignedToUserId ?? null,
      reason: parsed.data.reason ?? null,
    });

    return res.json({ escalation: esc });
  });

  // Close a session (owner or staff)
  app.post("/api/outlet/sessions/:id/close", requireAuth, async (req, res) => {
    const sessionId = String(req.params.id || "");
    const auth = (req as any).auth!;

    const session = await getOutletSession({ orgId: auth.orgId, sessionId });
    if (!session) return res.status(404).json({ error: "Session not found" });

    const isOwner = session.userId === auth.userId;
    const isStaff = auth.role === "admin" || auth.role === "manager";
    if (!isOwner && !isStaff) return res.status(403).json({ error: "Forbidden" });

    const ok = await closeOutletSession({ orgId: auth.orgId, sessionId });
    return res.json({ ok: !!ok });
  });

  // -----------------------------
  // Exports (CSV): ADMIN ONLY ✅
  // -----------------------------
  app.get("/api/export/checkins.csv", requireAuth, requireRole(["admin"]), async (req, res) => {
    const schema = z.object({
      userId: z.string().optional(),
      sinceDays: z.string().optional(),
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    let sinceDayKey: string | undefined = undefined;
    if (parsed.data.sinceDays) {
      const n = Number(parsed.data.sinceDays);
      const days = Number.isFinite(n) ? Math.max(1, Math.min(n, 365)) : 30;
      sinceDayKey = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }

    const csv = await exportCheckinsCsv({
      orgId: (req as any).auth!.orgId,
      userId: parsed.data.userId,
      sinceDayKey,
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="checkins.csv"');
    return res.send(csv);
  });

  app.get("/api/export/users.csv", requireAuth, requireRole(["admin"]), async (req, res) => {
    const csv = await exportUsersCsv({ orgId: (req as any).auth!.orgId });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="users.csv"');
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
    const limitRaw = parsed.data.limit ? Number(parsed.data.limit) : 200;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 500)) : 200;

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

    const daysRaw = parsed.data.days ? Number(parsed.data.days) : 30;
    const days = Number.isFinite(daysRaw) ? Math.max(7, Math.min(daysRaw, 365)) : 30;

    const summary = await orgSummary({ orgId: (req as any).auth!.orgId, days });
    return res.json({ summary });
  });

  app.get("/api/analytics/summary", requireAuth, async (req, res) => {
    const schema = z.object({ days: z.string().optional() });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const auth = (req as any).auth!;
    const daysRaw = parsed.data.days ? Number(parsed.data.days) : 30;
    const days = Number.isFinite(daysRaw) ? Math.max(7, Math.min(daysRaw, 365)) : 30;

    const summary = await summaryForUser({ orgId: auth.orgId, userId: auth.userId, days });
    return res.json({ summary });
  });
}
