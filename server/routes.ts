// server/routes.ts (FULL REPLACEMENT)
import type { Express, Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  createOrg,
  createUser,
  findUserByUsername,
  // Optional Path A helpers (present in storage.ts replacement)
  setUserHandle,

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

  // ✅ Inbox
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

function normalizeLoginIdentifier(s: string) {
  return String(s ?? "").trim().toLowerCase();
}

function isEmailLike(s: string) {
  return /\S+@\S+\.\S+/.test(String(s ?? "").trim());
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
 * ✅ Rules (Path A)
 * - Register: handle-style usernames only (no @)
 * - Login: allow handle OR email (legacy)
 */
const HandleUsernameSchema = z
  .string()
  .min(3)
  .max(40)
  .regex(/^[a-zA-Z0-9._-]+$/, "Username can only contain letters, numbers, dot, underscore, hyphen");

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
  username: LoginIdSchema,
  password: PasswordSchema,
});

const InviteAcceptSchema = z.object({
  token: z.string().min(10),
  username: HandleUsernameSchema,
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
  kind: z.enum(["outlet", "confessional"]).optional(),
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

      const uNorm = normalizeLoginIdentifier(username);

      const existing = await findUserByUsername(uNorm);
      if (existing) return res.status(409).json({ error: "Username already exists" });

      const org = await createOrg(orgName);
      const user = await createUser({ username: uNorm, password, orgId: org.id, role: "admin" });

      const token = signToken({ userId: user.id, orgId: org.id, role: user.role });
      return res.json({
        token,
        user: { id: user.id, username: user.username, orgId: user.orgId, role: user.role, handle: (user as any).handle ?? null },
        org,
      });
    }),
  );

  app.post(
    "/api/auth/login",
    wrap(async (req, res) => {
      const parsed = LoginSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const loginId = normalizeLoginIdentifier(parsed.data.username);
      const password = parsed.data.password;

      // Path A: handles are still stored as users.username (and also users.handle),
      // emails (legacy) are stored as users.username.
      const user = await findUserByUsername(loginId);
      if (!user) return res.status(401).json({ error: "Invalid credentials" });

      const ok = verifyPassword(password, user.passwordHash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });

      const org = await getOrg(user.orgId);
      if (!org) return res.status(401).json({ error: "Account org not found" });

      const token = signToken({ userId: user.id, orgId: user.orgId, role: user.role });
      return res.json({
        token,
        user: { id: user.id, username: user.username, orgId: user.orgId, role: user.role, handle: (user as any).handle ?? null },
        org,
      });
    }),
  );

  // -----------------------------
  // Invites (accept flow)
  // -----------------------------
  app.get(
    "/api/invites/:token",
    wrap(async (req, res) => {
      const token = String(req.params.token || "");
      const inv = await getInvite(token);
      if (!inv) return res.status(404).json({ error: "Invite not found" });
      if (isExpired(inv.expiresAt)) return res.status(410).json({ error: "Invite expired" });
      return res.json({ invite: { token: inv.token, orgId: inv.orgId, role: inv.role, expiresAt: inv.expiresAt } });
    }),
  );

  app.post(
    "/api/invites/accept",
    wrap(async (req, res) => {
      const parsed = InviteAcceptSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const token = parsed.data.token;
      const inv = await getInvite(token);
      if (!inv) return res.status(404).json({ error: "Invite not found" });
      if (isExpired(inv.expiresAt)) return res.status(410).json({ error: "Invite expired" });

      const uNorm = normalizeLoginIdentifier(parsed.data.username);

      const existing = await findUserByUsername(uNorm);
      if (existing) return res.status(409).json({ error: "Username already exists" });

      const user = await createUser({ username: uNorm, password: parsed.data.password, orgId: inv.orgId, role: inv.role });
      await deleteInvite(token);

      const org = await getOrg(inv.orgId);
      const jwt = signToken({ userId: user.id, orgId: inv.orgId, role: user.role });

      return res.json({
        token: jwt,
        user: { id: user.id, username: user.username, orgId: user.orgId, role: user.role, handle: (user as any).handle ?? null },
        org,
      });
    }),
  );

  // -----------------------------
  // ✅ Me
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
          handle: (u as any)?.handle ?? null,
        },
      });
    }),
  );

  // Optional Path A: claim/update handle for current user
  app.post(
    "/api/me/handle",
    requireAuth,
    wrap(async (req, res) => {
      const schema = z.object({
        handle: z
          .string()
          .min(3)
          .max(40)
          .regex(/^[a-z0-9._-]+$/i, "Handle can only contain letters, numbers, dot, underscore, hyphen")
          .transform((s) => s.trim().toLowerCase()),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const auth = (req as any).auth!;
      const ok = await setUserHandle({ orgId: auth.orgId, userId: auth.userId, handle: parsed.data.handle });
      return res.json({ ok: !!ok });
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
  // Invites (admin)
  // -----------------------------
  app.post(
    "/api/invites",
    requireAuth,
    requireRole(["admin"]),
    wrap(async (req, res) => {
      const schema = z.object({
        role: z.enum(["user", "manager", "admin"]).default("user"),
        expiresInHours: z.number().int().min(1).max(24 * 14).default(24),
      });
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const auth = (req as any).auth!;
      const expiresAt = new Date(Date.now() + parsed.data.expiresInHours * 60 * 60 * 1000).toISOString();

      const invite = await createInvite({
        orgId: auth.orgId,
        role: parsed.data.role,
        expiresAt,
        createdBy: auth.userId,
      });

      return res.json({ invite });
    }),
  );

  app.delete(
    "/api/invites/:token",
    requireAuth,
    requireRole(["admin"]),
    wrap(async (req, res) => {
      const token = String(req.params.token || "");
      const inv = await getInvite(token);
      if (!inv) return res.json({ ok: true });
      if (inv.orgId !== (req as any).auth!.orgId) return res.status(403).json({ error: "Forbidden" });

      const ok = await deleteInvite(token);
      return res.json({ ok: !!ok });
    }),
  );

  // -----------------------------
  // Password resets
  // -----------------------------
  app.post(
    "/api/password-resets",
    requireAuth,
    requireRole(["admin", "manager"]),
    wrap(async (req, res) => {
      const schema = z.object({
        userId: z.string().min(3),
        expiresInHours: z.number().int().min(1).max(24 * 7).default(2),
      });
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const auth = (req as any).auth!;
      const target = await assertUserInOrgOr404(auth.orgId, parsed.data.userId, res);
      if (!target) return;

      const expiresAt = new Date(Date.now() + parsed.data.expiresInHours * 60 * 60 * 1000).toISOString();
      const reset = await createPasswordReset({
        orgId: auth.orgId,
        userId: parsed.data.userId,
        expiresAt,
        createdBy: auth.userId,
      });

      return res.json({ reset });
    }),
  );

  app.get(
    "/api/password-resets/:token",
    wrap(async (req, res) => {
      const token = String(req.params.token || "");
      const reset = await getPasswordReset(token);
      if (!reset) return res.status(404).json({ error: "Reset not found" });
      if (isExpired(reset.expiresAt)) return res.status(410).json({ error: "Reset expired" });
      return res.json({ reset: { token: reset.token, orgId: reset.orgId, userId: reset.userId, expiresAt: reset.expiresAt } });
    }),
  );

  app.post(
    "/api/password-resets/:token/consume",
    wrap(async (req, res) => {
      const token = String(req.params.token || "");
      const schema = z.object({ password: PasswordSchema });
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const reset = await getPasswordReset(token);
      if (!reset) return res.status(404).json({ error: "Reset not found" });
      if (isExpired(reset.expiresAt)) return res.status(410).json({ error: "Reset expired" });

      await setUserPassword(reset.userId, parsed.data.password);
      await deletePasswordReset(token);

      // auto-login after reset
      const u = await getUserById(reset.userId);
      if (!u) return res.status(404).json({ error: "User not found" });

      const org = await getOrg(u.orgId);
      const jwt = signToken({ userId: u.id, orgId: u.orgId, role: u.role });

      return res.json({
        token: jwt,
        user: { id: u.id, username: u.username, orgId: u.orgId, role: u.role, handle: (u as any).handle ?? null },
        org,
      });
    }),
  );

  app.delete(
    "/api/password-resets/:token",
    requireAuth,
    requireRole(["admin", "manager"]),
    wrap(async (req, res) => {
      const token = String(req.params.token || "");
      const reset = await getPasswordReset(token);
      if (!reset) return res.json({ ok: true });

      const auth = (req as any).auth!;
      if (reset.orgId !== auth.orgId) return res.status(403).json({ error: "Forbidden" });

      const ok = await deletePasswordReset(token);
      return res.json({ ok: !!ok });
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
  // Profiles (self)
  // -----------------------------
  app.get(
    "/api/profile",
    requireAuth,
    wrap(async (req, res) => {
      const auth = (req as any).auth!;
      const profile = await getUserProfile(auth.orgId, auth.userId);
      return res.json({ profile });
    }),
  );

  app.post(
    "/api/profile",
    requireAuth,
    wrap(async (req, res) => {
      const schema = z.object({
        fullName: z.string().max(120).optional().nullable(),
        email: z.string().max(200).optional().nullable(),
        phone: z.string().max(40).optional().nullable(),
        tags: z.array(z.string().max(24)).max(20).optional(),
      });
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const auth = (req as any).auth!;
      const profile = await upsertUserProfile({
        orgId: auth.orgId,
        userId: auth.userId,
        fullName: parsed.data.fullName ?? null,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        tags: parsed.data.tags ?? [],
      });
      return res.json({ profile });
    }),
  );

  // -----------------------------
  // Notes (staff)
  // -----------------------------
  app.get(
    "/api/users/:id/notes",
    requireAuth,
    requireRole(["admin", "manager"]),
    wrap(async (req, res) => {
      const userId = String(req.params.id || "");
      const schema = z.object({ limit: z.string().optional() });
      const parsed = schema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const auth = (req as any).auth!;
      const target = await assertUserInOrgOr404(auth.orgId, userId, res);
      if (!target) return;

      const limitRaw = parsed.data.limit ? Number(parsed.data.limit) : 100;
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 500)) : 100;

      const notes = await listUserNotes({ orgId: auth.orgId, userId, limit });
      return res.json({ notes });
    }),
  );

  app.post(
    "/api/users/:id/notes",
    requireAuth,
    requireRole(["admin", "manager"]),
    wrap(async (req, res) => {
      const userId = String(req.params.id || "");
      const schema = z.object({ note: z.string().min(1).max(2000), ts: z.string().datetime().optional() });
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const auth = (req as any).auth!;
      const target = await assertUserInOrgOr404(auth.orgId, userId, res);
      if (!target) return;

      const row = await addUserNote({
        orgId: auth.orgId,
        userId,
        authorId: auth.userId,
        note: parsed.data.note,
        ts: parsed.data.ts,
      });

      return res.json({ note: row });
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
        kind: parsed.data.kind,
        category: parsed.data.category ?? null,
        visibility: parsed.data.visibility,
        riskLevel: 0,
      });

      return res.json({ session });
    }),
  );

  app.get(
    "/api/outlet/sessions",
    requireAuth,
    wrap(async (req, res) => {
      const schema = z.object({ limit: z.string().optional() });
      const parsed = schema.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const auth = (req as any).auth!;
      const limitRaw = parsed.data.limit ? Number(parsed.data.limit) : 50;
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 200)) : 50;

      const sessions = await listOutletSessionsForUser({ orgId: auth.orgId, userId: auth.userId, limit });
      return res.json({ sessions });
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
