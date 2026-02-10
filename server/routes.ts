// server/routes.ts (FULL REPLACEMENT)
import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  createOrg,
  createUser,
  findUserByUsername,
  getOrg,
  getUserById,
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

  // outlet admin helpers
  resolveOutletSession,
  outletAnalyticsSummary,

  // ✅ Inbox (MATCHES storage.ts)
  listInboxForUser,
  markInboxRead,
  markInboxAck,
  listStaffInboxMessages,
  createStaffInboxMessage,
} from "./storage.js";
import { requireAuth, requireRole, signToken, verifyPassword } from "./auth.js";

/** Async route wrapper */
function wrap(fn: (req: Request, res: Response, next: NextFunction) => Promise<any> | any) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function isExpired(expiresAtIso: string) {
  const t = new Date(expiresAtIso).getTime();
  return !Number.isFinite(t) || t < Date.now();
}

async function assertUserInOrgOr404(orgId: string, userId: string, res: Response) {
  const u = await getUserById(userId);
  if (!u || u.orgId !== orgId) {
    res.status(404).json({ error: "User not found" });
    return null;
  }
  return u;
}

/**
 * Outlet AI stub (safe placeholder)
 */
async function generateOutletAiReply(params: { userMessage: string }) {
  const msg = (params.userMessage ?? "").trim();
  if (!msg) return { reply: "Tell me what’s going on — I’m here.", riskLevel: 0 };

  const lowered = msg.toLowerCase();
  const riskKeywords = ["suicide", "kill myself", "self harm", "self-harm", "hurt myself", "end my life", "i want to die"];
  const riskLevel = riskKeywords.some((k) => lowered.includes(k)) ? 2 : 0;

  if (riskLevel >= 2) {
    return {
      riskLevel,
      reply:
        "I’m really glad you said something.\n\n" +
        "If you’re in immediate danger, call 911 or go to the nearest ER.\n" +
        "In the U.S., you can call or text **988**.\n\n" +
        "If you want, we can escalate this to an admin right now.\n\n" +
        "Are you safe right this moment? (yes/no)",
    };
  }

  return {
    riskLevel: 0,
    reply:
      "Thank you — I hear you.\n\n" +
      "What would a **reasonable outcome** look like for you?\n" +
      "Answer in one sentence.",
  };
}

/**
 * ✅ Rules
 * - Register: handle-style usernames only (no @)
 * - Login: allow handle OR email (to support legacy users)
 */
const HandleUsernameSchema = z
  .string()
  .min(3)
  .max(40)
  .regex(/^[a-zA-Z0-9._-]+$/, "Username can only contain letters, numbers, dot, underscore, hyphen");

// Login identifier: either handle OR email-like
const LoginIdSchema = z
  .string()
  .min(3)
  .max(120)
  .transform((s) => s.trim())
  .refine((s) => s.length >= 3, "Username/email required")
  .refine(
    (s) => /^[a-zA-Z0-9._-]+$/.test(s) || /^\S+@\S+\.\S+$/.test(s),
    "Enter a username (letters/numbers/._-) or an email",
  );

const PasswordSchema = z.string().min(6).max(200);

const RegisterSchema = z.object({
  orgName: z.string().min(2).max(80).optional(),
  username: HandleUsernameSchema,
  password: PasswordSchema,
});

const LoginSchema = z.object({
  // ✅ allow email OR handle
  username: LoginIdSchema,
  password: PasswordSchema,
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

const OutletResolveSchema = z.object({
  resolutionNote: z.string().max(2000).optional().nullable(),
});

async function staffCanAccessOutletSession(auth: any, sessionId: string): Promise<boolean> {
  const role = auth?.role;
  if (role !== "admin" && role !== "manager") return false;

  const sessions = await listOutletSessionsForStaff({
    orgId: auth.orgId,
    role,
    staffUserId: auth.userId,
    limit: 300,
  });

  return sessions.some((s: any) => s.id === sessionId);
}

function normalizeLoginIdentifier(s: string) {
  return String(s ?? "").trim().toLowerCase();
}

export function registerRoutes(app: Express) {
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // -----------------------------
  // Auth
  // -----------------------------
  app.post(
    "/api/auth/register",
    wrap(async (req, res) => {
      const parsed = RegisterSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const { username, password } = parsed.data;
      const orgName = parsed.data.orgName?.trim() || "My Org";

      // normalize to match storage normalization
      const uNorm = normalizeLoginIdentifier(username);

      const existing = await findUserByUsername(uNorm);
      if (existing) return res.status(409).json({ error: "Username already exists" });

      const org = await createOrg(orgName);
      const user = await createUser({ username: uNorm, password, orgId: org.id, role: "admin" });

      const token = signToken({ userId: user.id, orgId: org.id, role: user.role });
      return res.json({
        token,
        user: { id: user.id, username: user.username, orgId: user.orgId, role: user.role },
        org,
      });
    }),
  );

  app.post(
    "/api/auth/login",
    wrap(async (req, res) => {
      const parsed = LoginSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const usernameInput = normalizeLoginIdentifier(parsed.data.username);
      const password = parsed.data.password;

      // ✅ legacy-compatible: find by stored username (which might be an email)
      const user = await findUserByUsername(usernameInput);
      if (!user) return res.status(401).json({ error: "Invalid credentials" });

      const ok = verifyPassword(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      const org = await getOrg(user.orgId);
      if (!org) return res.status(401).json({ error: "Account org not found" });

      const token = signToken({ userId: user.id, orgId: user.orgId, role: user.role });
      return res.json({
        token,
        user: { id: user.id, username: user.username, orgId: user.orgId, role: user.role },
        org,
      });
    }),
  );

  // -----------------------------
  // ✅ Me (auth identity) — Path A
  // -----------------------------
  app.get(
    "/api/me",
    requireAuth,
    wrap(async (req, res) => {
      const auth = (req as any).auth!;
      const u = await getUserById(auth.userId);
      return res.json({
        auth: {
          userId: auth.userId,
          orgId: auth.orgId,
          role: auth.role,
          username: u?.username ?? undefined,
        },
      });
    }),
  );

  // -----------------------------
  // Org + Users
  // -----------------------------
  app.get(
    "/api/org",
    requireAuth,
    wrap(async (req, res) => {
      const org = await getOrg((req as any).auth!.orgId);
      return res.json({ org });
    }),
  );

  app.get(
    "/api/users",
    requireAuth,
    requireRole(["admin", "manager"]),
    wrap(async (req, res) => {
      const users = await listUsers((req as any).auth!.orgId);
      return res.json({ users });
    }),
  );

  app.post(
    "/api/users/role",
    requireAuth,
    requireRole(["admin"]),
    wrap(async (req, res) => {
      const schema = z.object({ userId: z.string().min(3), role: z.enum(["user", "manager", "admin"]) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const auth = (req as any).auth!;
      const target = await assertUserInOrgOr404(auth.orgId, parsed.data.userId, res);
      if (!target) return;

      const ok = await setUserRole(auth.orgId, parsed.data.userId, parsed.data.role);
      return res.json({ ok });
    }),
  );

  // -----------------------------
  // ✅ Inbox (User)
  // -----------------------------
  app.get(
    "/api/inbox",
    requireAuth,
    wrap(async (req, res) => {
      const schema = z.object({ limit: z.string().optional() });
      const parsed = schema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const auth = (req as any).auth!;
      const limitRaw = parsed.data.limit ? Number(parsed.data.limit) : 100;
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 300)) : 100;

      const items = await listInboxForUser({ orgId: auth.orgId, userId: auth.userId, limit });
      return res.json({ items });
    }),
  );

  app.post(
    "/api/inbox/:id/read",
    requireAuth,
    wrap(async (req, res) => {
      const id = String(req.params.id || "");
      const auth = (req as any).auth!;
      const ok = await markInboxRead({ orgId: auth.orgId, userId: auth.userId, itemId: id });
      return res.json({ ok: !!ok });
    }),
  );

  app.post(
    "/api/inbox/:id/ack",
    requireAuth,
    wrap(async (req, res) => {
      const id = String(req.params.id || "");
      const auth = (req as any).auth!;
      const ok = await markInboxAck({ orgId: auth.orgId, userId: auth.userId, itemId: id });
      return res.json({ ok: !!ok });
    }),
  );

  // -----------------------------
  // ✅ Inbox (Staff)
  // -----------------------------
  app.get(
    "/api/staff/inbox/messages",
    requireAuth,
    requireRole(["admin", "manager"]),
    wrap(async (req, res) => {
      const schema = z.object({
        userId: z.string().min(3),
        limit: z.string().optional(),
      });
      const parsed = schema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const auth = (req as any).auth!;
      const target = await assertUserInOrgOr404(auth.orgId, parsed.data.userId, res);
      if (!target) return;

      const limitRaw = parsed.data.limit ? Number(parsed.data.limit) : 200;
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 500)) : 200;

      const messages = await listStaffInboxMessages({ orgId: auth.orgId, userId: parsed.data.userId, limit });
      return res.json({ messages });
    }),
  );

  app.post(
    "/api/staff/inbox/messages",
    requireAuth,
    requireRole(["admin", "manager"]),
    wrap(async (req, res) => {
      const schema = z.object({
        userId: z.string().min(3),
        content: z.string().min(1).max(4000),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const auth = (req as any).auth!;
      const target = await assertUserInOrgOr404(auth.orgId, parsed.data.userId, res);
      if (!target) return;

      const msg = await createStaffInboxMessage({
        orgId: auth.orgId,
        userId: parsed.data.userId,
        staffUserId: auth.userId,
        content: parsed.data.content,
      });

      return res.json({ message: msg });
    }),
  );

  // -----------------------------
  // Check-ins
  // -----------------------------
  app.post(
    "/api/checkins",
    requireAuth,
    wrap(async (req, res) => {
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
    }),
  );

  app.get(
    "/api/checkins",
    requireAuth,
    wrap(async (req, res) => {
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
    }),
  );

  app.delete(
    "/api/checkins/:id",
    requireAuth,
    wrap(async (req, res) => {
      const id = String(req.params.id || "");
      const auth = (req as any).auth!;
      const ok = await deleteCheckIn(auth.orgId, auth.userId, id);
      return res.json({ ok });
    }),
  );

  // -----------------------------
  // Habits
  // -----------------------------
  app.post(
    "/api/habits",
    requireAuth,
    wrap(async (req, res) => {
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
    }),
  );

  app.get(
    "/api/habits",
    requireAuth,
    wrap(async (req, res) => {
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
    }),
  );

  app.post(
    "/api/habits/:id/archive",
    requireAuth,
    wrap(async (req, res) => {
      const id = String(req.params.id || "");
      const auth = (req as any).auth!;
      const ok = await archiveHabit(auth.orgId, auth.userId, id);
      return res.json({ ok });
    }),
  );

  // -----------------------------
  // Outlet
  // -----------------------------
  app.post(
    "/api/outlet/sessions",
    requireAuth,
    wrap(async (req, res) => {
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
    }),
  );

  app.get(
    "/api/outlet/sessions/:id",
    requireAuth,
    wrap(async (req, res) => {
      const sessionId = String(req.params.id || "");
      const auth = (req as any).auth!;

      const session = await getOutletSession({ orgId: auth.orgId, sessionId });
      if (!session) return res.status(404).json({ error: "Session not found" });

      const isOwner = session.userId === auth.userId;
      if (!isOwner) {
        const allowed = await staffCanAccessOutletSession(auth, sessionId);
        if (!allowed) return res.status(403).json({ error: "Forbidden" });
      }

      const messages = await listOutletMessages({ orgId: auth.orgId, sessionId });
      return res.json({ session, messages });
    }),
  );

  app.post(
    "/api/outlet/sessions/:id/messages",
    requireAuth,
    wrap(async (req, res) => {
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

      const ai = await generateOutletAiReply({ userMessage: parsed.data.content });

      const aiMsg = await addOutletMessage({
        orgId: auth.orgId,
        sessionId,
        sender: "ai",
        content: ai.reply,
      });

      if (ai.riskLevel >= 2) {
        await escalateOutletSession({
          orgId: auth.orgId,
          sessionId,
          escalatedToRole: "admin",
          assignedToUserId: null,
          reason: "Auto-flag: safety keywords detected.",
        });
      }

      return res.json({ userMessage: userMsg, aiMessage: aiMsg, riskLevel: ai.riskLevel });
    }),
  );

  app.post(
    "/api/outlet/sessions/:id/escalate",
    requireAuth,
    wrap(async (req, res) => {
      const sessionId = String(req.params.id || "");
      const parsed = OutletEscalateSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const auth = (req as any).auth!;
      const session = await getOutletSession({ orgId: auth.orgId, sessionId });
      if (!session) return res.status(404).json({ error: "Session not found" });

      const isOwner = session.userId === auth.userId;
      const isStaff = auth.role === "admin" || auth.role === "manager";
      if (!isOwner && !isStaff) return res.status(403).json({ error: "Forbidden" });

      const esc = await escalateOutletSession({
        orgId: auth.orgId,
        sessionId,
        escalatedToRole: parsed.data.escalatedToRole,
        assignedToUserId: parsed.data.assignedToUserId ?? null,
        reason: parsed.data.reason ?? null,
      });

      return res.json({ escalation: esc });
    }),
  );

  app.post(
    "/api/outlet/sessions/:id/close",
    requireAuth,
    wrap(async (req, res) => {
      const sessionId = String(req.params.id || "");
      const auth = (req as any).auth!;

      const session = await getOutletSession({ orgId: auth.orgId, sessionId });
      if (!session) return res.status(404).json({ error: "Session not found" });

      const isOwner = session.userId === auth.userId;
      const isStaffAllowed = await staffCanAccessOutletSession(auth, sessionId);
      if (!isOwner && !isStaffAllowed) return res.status(403).json({ error: "Forbidden" });

      const ok = await closeOutletSession({ orgId: auth.orgId, sessionId });
      return res.json({ ok: !!ok });
    }),
  );

  app.post(
    "/api/outlet/sessions/:id/resolve",
    requireAuth,
    requireRole(["admin", "manager"]),
    wrap(async (req, res) => {
      const sessionId = String(req.params.id || "");
      const parsed = OutletResolveSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const auth = (req as any).auth!;
      const allowed = await staffCanAccessOutletSession(auth, sessionId);
      if (!allowed) return res.status(403).json({ error: "Forbidden" });

      const ok = await resolveOutletSession({
        orgId: auth.orgId,
        sessionId,
        resolvedByUserId: auth.userId,
        resolutionNote: parsed.data.resolutionNote ?? null,
      });

      return res.json({ ok: !!ok });
    }),
  );

  app.get(
    "/api/outlet/analytics/summary",
    requireAuth,
    requireRole(["admin", "manager"]),
    wrap(async (req, res) => {
      const schema = z.object({ days: z.string().optional() });
      const parsed = schema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const daysRaw = parsed.data.days ? Number(parsed.data.days) : 30;
      const days = Number.isFinite(daysRaw) ? Math.max(7, Math.min(daysRaw, 365)) : 30;

      const summary = await outletAnalyticsSummary({ orgId: (req as any).auth!.orgId, days });
      return res.json({ summary });
    }),
  );

  // -----------------------------
  // Analytics
  // -----------------------------
  app.get(
    "/api/analytics/org-summary",
    requireAuth,
    requireRole(["admin", "manager"]),
    wrap(async (req, res) => {
      const schema = z.object({ days: z.string().optional() });
      const parsed = schema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const daysRaw = parsed.data.days ? Number(parsed.data.days) : 30;
      const days = Number.isFinite(daysRaw) ? Math.max(7, Math.min(daysRaw, 365)) : 30;

      const summary = await orgSummary({ orgId: (req as any).auth!.orgId, days });
      return res.json({ summary });
    }),
  );

  app.get(
    "/api/analytics/summary",
    requireAuth,
    wrap(async (req, res) => {
      const schema = z.object({ days: z.string().optional() });
      const parsed = schema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const auth = (req as any).auth!;
      const daysRaw = parsed.data.days ? Number(parsed.data.days) : 30;
      const days = Number.isFinite(daysRaw) ? Math.max(7, Math.min(daysRaw, 365)) : 30;

      const summary = await summaryForUser({ orgId: auth.orgId, userId: auth.userId, days });
      return res.json({ summary });
    }),
  );

  // -----------------------------
  // Exports (CSV): ADMIN ONLY
  // -----------------------------
  app.get(
    "/api/export/checkins.csv",
    requireAuth,
    requireRole(["admin"]),
    wrap(async (req, res) => {
      const schema = z.object({
        userId: z.string().optional(),
        sinceDays: z.string().optional(),
      });
      const parsed = schema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const auth = (req as any).auth!;

      if (parsed.data.userId) {
        const target = await assertUserInOrgOr404(auth.orgId, parsed.data.userId, res);
        if (!target) return;
      }

      let sinceDayKey: string | undefined = undefined;
      if (parsed.data.sinceDays) {
        const n = Number(parsed.data.sinceDays);
        const days = Number.isFinite(n) ? Math.max(1, Math.min(n, 365)) : 30;
        sinceDayKey = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      }

      const csv = await exportCheckinsCsv({
        orgId: auth.orgId,
        userId: parsed.data.userId,
        sinceDayKey,
      });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="checkins.csv"');
      return res.send(csv);
    }),
  );

  app.get(
    "/api/export/users.csv",
    requireAuth,
    requireRole(["admin"]),
    wrap(async (req, res) => {
      const csv = await exportUsersCsv({ orgId: (req as any).auth!.orgId });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="users.csv"');
      return res.send(csv);
    }),
  );

  // -----------------------------
  // Error handler
  // -----------------------------
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("API error:", err);
    const msg = typeof err?.message === "string" ? err.message : "Server error";
    return res.status(500).json({ error: msg });
  });
}
