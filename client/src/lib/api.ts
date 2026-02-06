// client/src/lib/api.ts (FULL REPLACEMENT)

export type Role = "user" | "manager" | "admin";

export type AuthUser = { id: string; username: string; orgId: string; role: Role };
export type Org = { id: string; name: string; createdAt: string };

export type InviteInfo = { token: string; role: Role; expiresAt: string };
export type UserProfile = {
  userId: string;
  orgId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  tagsJson: string;
  createdAt: string;
  updatedAt: string;
};
export type UserNote = {
  id: string;
  orgId: string;
  userId: string;
  authorId: string;
  authorUsername: string;
  ts: string;
  note: string;
  createdAt: string;
};

export type CheckIn = {
  id: string;
  orgId: string;
  userId: string;
  ts: string;
  dayKey: string;
  mood: number;
  energy: number;
  stress: number;
  note: string | null;
  tagsJson: string;
  createdAt: string;
};

export type Habit = {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  targetPerWeek: number;
  createdAt: string;
  archivedAt: string | null;
};

export type OrgSummary = {
  days: number;
  overall: {
    moodAvg: number | null;
    energyAvg: number | null;
    stressAvg: number | null;
    checkins: number;
    users: number;
  };
  byDay: Array<{
    dayKey: string;
    moodAvg: number;
    energyAvg: number;
    stressAvg: number;
    checkins: number;
    users: number;
  }>;
  risk: Array<{ userId: string; username: string; moodAvg: number; stressAvg: number; count: number }>;
};

export type Summary = {
  days: number;
  streak: number;
  today: string;
  overall: { moodAvg: number | null; energyAvg: number | null; stressAvg: number | null; total: number };
  byDay: Array<{ dayKey: string; moodAvg: number; energyAvg: number; stressAvg: number; count: number }>;
};

/** Outlet / Counselor’s Office */
export type OutletVisibility = "private" | "manager" | "admin";
export type OutletStatus = "open" | "escalated" | "closed";
export type OutletSession = {
  id: string;
  orgId: string;
  userId: string;
  visibility: OutletVisibility;
  category: string | null;
  status: OutletStatus;
  riskLevel: number;
  createdAt: string;
  updatedAt: string;
};
export type OutletMessage = {
  id: string;
  orgId: string;
  sessionId: string;
  sender: "user" | "ai";
  content: string;
  createdAt: string;
};

const TOKEN_KEY = "levelup_token";
const LEGACY_TOKEN_KEYS = ["token", "levelupToken", "jwt"] as const;

/** Read token (supports legacy keys for older builds) */
export function getToken() {
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) return t;

  for (const k of LEGACY_TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

/** Write token + keep storage clean */
export function setToken(t: string | null) {
  if (!t) {
    localStorage.removeItem(TOKEN_KEY);
    for (const k of LEGACY_TOKEN_KEYS) localStorage.removeItem(k);
    return;
  }
  localStorage.setItem(TOKEN_KEY, t);
}

/**
 * Optional absolute API base:
 *   VITE_API_BASE=https://your-api-domain
 * Defaults to same-origin.
 */
const API_BASE = ((import.meta as any)?.env?.VITE_API_BASE || "").toString().replace(/\/+$/, "");
function apiUrl(path: string) {
  if (!path.startsWith("/")) path = `/${path}`;
  return `${API_BASE}${path}`;
}

function bestErrorMessage(data: any): string {
  const msg = data?.error?.message ?? data?.error ?? data?.message ?? data?.detail ?? data?.statusText ?? null;
  if (typeof msg === "string" && msg.trim()) return msg.trim();
  return "Request failed";
}

async function req<T>(method: string, url: string, body?: any): Promise<T> {
  const token = getToken();

  const res = await fetch(apiUrl(url), {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // handle 204 / non-json gracefully
  const text = await res.text().catch(() => "");
  const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};

  if (!res.ok) {
    throw new Error(bestErrorMessage(data));
  }

  return data as T;
}

/** Backwards-compatible helpers (older pages import these) */
export type AuthPayload = { userId: string; orgId: string; role: Role; username?: string };

export function apiGet<T>(url: string) {
  return req<T>("GET", url);
}
export function apiPost<T>(url: string, body?: any) {
  return req<T>("POST", url, body);
}
export function apiPut<T>(url: string, body?: any) {
  return req<T>("PUT", url, body);
}
export function apiDelete<T>(url: string) {
  return req<T>("DELETE", url);
}

export const api = {
  async register(orgName: string, username: string, password: string) {
    return req<{ token: string; user: AuthUser; org: Org }>("POST", "/api/auth/register", { orgName, username, password });
  },
  async login(username: string, password: string) {
    return req<{ token: string; user: AuthUser; org: Org }>("POST", "/api/auth/login", { username, password });
  },
  async org() {
    return req<{ org: Org }>("GET", "/api/org");
  },
  async users() {
    return req<{ users: AuthUser[] }>("GET", "/api/users");
  },
  async adminCreateUser(payload: { username: string; password: string; role: Role }) {
    return req<{ user: AuthUser }>("POST", "/api/admin/users", payload);
  },
  async setRole(userId: string, role: Role) {
    return req<{ ok: boolean }>("POST", "/api/users/role", { userId, role });
  },

  async createCheckin(payload: { mood: number; energy: number; stress: number; note?: string; tags?: string[] }) {
    return req<{ checkin: CheckIn }>("POST", "/api/checkins", payload);
  },
  async listCheckins(limit = 200) {
    return req<{ checkins: CheckIn[] }>("GET", `/api/checkins?limit=${encodeURIComponent(String(limit))}`);
  },
  async deleteCheckin(id: string) {
    return req<{ ok: boolean }>("DELETE", `/api/checkins/${encodeURIComponent(id)}`);
  },

  async createHabit(payload: { name: string; targetPerWeek: number }) {
    return req<{ habit: Habit }>("POST", "/api/habits", payload);
  },
  async listHabits(includeArchived = false) {
    return req<{ habits: Habit[] }>("GET", `/api/habits?includeArchived=${includeArchived ? "1" : "0"}`);
  },
  async archiveHabit(id: string) {
    return req<{ ok: boolean }>("POST", `/api/habits/${encodeURIComponent(id)}/archive`);
  },

  async summary(days = 30) {
    return req<{ summary: Summary }>("GET", `/api/analytics/summary?days=${encodeURIComponent(String(days))}`);
  },
  async orgSummary(days = 30) {
    return req<{ summary: OrgSummary }>("GET", `/api/analytics/org-summary?days=${encodeURIComponent(String(days))}`);
  },

  async createInvite(payload: { role: Role; expiresInDays: number }) {
    return req<{ invite: InviteInfo; urlPath: string }>("POST", "/api/admin/invites", payload);
  },
  async getInvite(token: string) {
    return req<{ invite: InviteInfo; org: Org }>("GET", `/api/invites/${encodeURIComponent(token)}`);
  },
  async acceptInvite(token: string, payload: { username: string; password: string }) {
    return req<{ token: string; user: AuthUser; org: Org }>("POST", `/api/invites/${encodeURIComponent(token)}/accept`, payload);
  },

  async requestPasswordReset(username: string) {
    return req<{ reset: { token: string; expiresAt: string } }>("POST", "/api/auth/request-reset", { username });
  },
  async resetPassword(token: string, newPassword: string) {
    return req<{ ok: boolean }>("POST", "/api/auth/reset", { token, newPassword });
  },
  async adminCreateResetToken(userId: string, expiresInMinutes = 60) {
    return req<{ reset: { token: string; expiresAt: string } }>(
      "POST",
      `/api/admin/users/${encodeURIComponent(userId)}/reset-token`,
      { expiresInMinutes },
    );
  },

  async getProfile(userId: string) {
    return req<{ profile: UserProfile }>("GET", `/api/users/${encodeURIComponent(userId)}/profile`);
  },
  async updateProfile(userId: string, payload: { fullName?: string | null; email?: string | null; phone?: string | null; tags?: string[] }) {
    return req<{ profile: UserProfile }>("PUT", `/api/users/${encodeURIComponent(userId)}/profile`, payload);
  },
  async listNotes(userId: string, limit = 100) {
    return req<{ notes: UserNote[] }>(
      "GET",
      `/api/users/${encodeURIComponent(userId)}/notes?limit=${encodeURIComponent(String(limit))}`,
    );
  },
  async addNote(userId: string, note: string) {
    return req<{ note: any }>("POST", `/api/users/${encodeURIComponent(userId)}/notes`, { note });
  },

  /** Outlet / Counselor’s Office */
  async outletCreateSession(payload: { category?: string | null; visibility?: OutletVisibility }) {
    return req<{ session: OutletSession }>("POST", "/api/outlet/sessions", payload);
  },
  async outletListMySessions(limit = 50) {
    return req<{ sessions: OutletSession[] }>("GET", `/api/outlet/sessions?limit=${encodeURIComponent(String(limit))}`);
  },
  async outletListStaffSessions(limit = 200) {
    return req<{ sessions: OutletSession[] }>("GET", `/api/outlet/sessions?view=staff&limit=${encodeURIComponent(String(limit))}`);
  },
  async outletGetSession(sessionId: string) {
    return req<{ session: OutletSession; messages: OutletMessage[] }>(
      "GET",
      `/api/outlet/sessions/${encodeURIComponent(sessionId)}`,
    );
  },
  async outletSendMessage(sessionId: string, content: string) {
    return req<{ userMessage: OutletMessage; aiMessage: OutletMessage; riskLevel: number }>(
      "POST",
      `/api/outlet/sessions/${encodeURIComponent(sessionId)}/messages`,
      { content },
    );
  },
  async outletEscalate(sessionId: string, payload: { escalatedToRole: "manager" | "admin"; assignedToUserId?: string | null; reason?: string | null }) {
    return req<{ escalation: any }>("POST", `/api/outlet/sessions/${encodeURIComponent(sessionId)}/escalate`, payload);
  },
  async outletClose(sessionId: string) {
    return req<{ ok: boolean }>("POST", `/api/outlet/sessions/${encodeURIComponent(sessionId)}/close`, {});
  },

  /** Optional: Outlet analytics (manager/admin). Safe to call only if backend exists. */
  async outletAnalyticsSummary(days = 30) {
    return req<{ summary: any }>("GET", `/api/outlet/analytics/summary?days=${encodeURIComponent(String(days))}`);
  },
};
