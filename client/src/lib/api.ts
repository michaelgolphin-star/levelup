// client/src/lib/api.ts (FULL REPLACEMENT)
export type Role = "user" | "manager" | "admin";

export type AuthPayload = {
  userId: string;
  orgId: string;
  role: Role;
  username?: string;
};

const TOKEN_KEY = "levelup_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (!token) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

function emitApiError(detail: any) {
  try {
    window.dispatchEvent(new CustomEvent("levelup_api_error", { detail }));
  } catch {
    // ignore
  }
}

async function request<T>(method: string, path: string, body?: any): Promise<T> {
  const token = getToken();

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e: any) {
    const msg = e?.message || "Network error";
    emitApiError({ path, method, status: 0, message: msg });
    throw new Error(msg);
  }

  let data: any = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (data && (data.error?.message || data.error || data.message)) ||
      `Request failed (${res.status})`;
    emitApiError({ path, method, status: res.status, message: msg, data });
    throw new Error(msg);
  }

  return data as T;
}

export async function apiGet<T>(path: string) {
  return request<T>("GET", path);
}

export async function apiPost<T>(path: string, body?: any) {
  return request<T>("POST", path, body);
}

export async function apiDelete<T>(path: string) {
  return request<T>("DELETE", path);
}

export const api = {
  // auth
  async login(username: string, password: string) {
    const r = await apiPost<{ token: string; user: any; org: any }>("/api/auth/login", { username, password });
    setToken(r.token);
    return r;
  },

  async register(orgName: string, username: string, password: string) {
    const r = await apiPost<{ token: string; user: any; org: any }>("/api/auth/register", { orgName, username, password });
    setToken(r.token);
    return r;
  },

  async me() {
    return apiGet<{ auth: AuthPayload }>("/api/me");
  },

  // checkins
  async createCheckin(payload: { mood: number; energy: number; stress: number; note?: string; tags?: string[] }) {
    return apiPost<{ checkin: any }>("/api/checkins", payload);
  },
  async listCheckins(limit = 200, dayKey?: string) {
    const qs = new URLSearchParams();
    if (dayKey) qs.set("dayKey", dayKey);
    qs.set("limit", String(limit));
    return apiGet<{ checkins: any[] }>(`/api/checkins?${qs.toString()}`);
  },
  async deleteCheckin(id: string) {
    return apiDelete<{ ok: boolean }>(`/api/checkins/${encodeURIComponent(id)}`);
  },

  // habits
  async createHabit(payload: { name: string; targetPerWeek: number }) {
    return apiPost<{ habit: any }>("/api/habits", payload);
  },
  async listHabits(includeArchived = false) {
    const qs = new URLSearchParams();
    if (includeArchived) qs.set("includeArchived", "1");
    return apiGet<{ habits: any[] }>(`/api/habits?${qs.toString()}`);
  },
  async archiveHabit(id: string) {
    return apiPost<{ ok: boolean }>(`/api/habits/${encodeURIComponent(id)}/archive`);
  },

  // analytics
  async summary(days = 30) {
    return apiGet<{ summary: any }>(`/api/analytics/summary?days=${encodeURIComponent(String(days))}`);
  },
  async orgSummary(days = 30) {
    return apiGet<{ summary: any }>(`/api/analytics/org-summary?days=${encodeURIComponent(String(days))}`);
  },

  // users (admin/manager listing; admin role edits)
  async listUsers() {
    return apiGet<{ users: any[] }>("/api/users");
  },
  async setUserRole(userId: string, role: Role) {
    return apiPost<{ ok: boolean }>("/api/users/role", { userId, role });
  },

  // ✅ admin helpers (1 & 2)
  async adminCreateUser(payload: { username: string; password: string; role?: Role }) {
    return apiPost<{ user: any }>("/api/admin/users", payload);
  },
  async adminSeedDemoUser(role: "user" | "manager" = "user") {
    return apiPost<{ seeded: { user: any; credentials: { username: string; password: string } } }>(
      "/api/admin/users/seed-demo",
      { role },
    );
  },

  // inbox
  async listInbox(limit = 100) {
    return apiGet<{ items: any[] }>(`/api/inbox?limit=${encodeURIComponent(String(limit))}`);
  },
  async markInboxRead(id: string) {
    return apiPost<{ ok: boolean }>(`/api/inbox/${encodeURIComponent(id)}/read`);
  },
  async markInboxAck(id: string) {
    return apiPost<{ ok: boolean }>(`/api/inbox/${encodeURIComponent(id)}/ack`);
  },

  // staff inbox messages
  async listStaffInboxMessages(userId: string, limit = 200) {
    const qs = new URLSearchParams({ userId, limit: String(limit) });
    return apiGet<{ messages: any[] }>(`/api/staff/inbox/messages?${qs.toString()}`);
  },
  async createStaffInboxMessage(userId: string, content: string) {
    return apiPost<{ message: any }>("/api/staff/inbox/messages", { userId, content });
  },

  // outlet
  async createOutletSession(payload: { category?: string | null; visibility?: "private" | "manager" | "admin" }) {
    return apiPost<{ session: any }>("/api/outlet/sessions", payload || {});
  },
  async getOutletSession(sessionId: string) {
    return apiGet<{ session: any; messages: any[] }>(`/api/outlet/sessions/${encodeURIComponent(sessionId)}`);
  },
  async postOutletMessage(sessionId: string, content: string) {
    return apiPost<any>(`/api/outlet/sessions/${encodeURIComponent(sessionId)}/messages`, { content });
  },
  async closeOutletSession(sessionId: string) {
    return apiPost<{ ok: boolean }>(`/api/outlet/sessions/${encodeURIComponent(sessionId)}/close`);
  },
  async resolveOutletSession(sessionId: string, resolutionNote?: string | null) {
    return apiPost<{ ok: boolean }>(`/api/outlet/sessions/${encodeURIComponent(sessionId)}/resolve`, { resolutionNote });
  },
  async outletAnalyticsSummary(days = 30) {
    return apiGet<{ summary: any }>(`/api/outlet/analytics/summary?days=${encodeURIComponent(String(days))}`);
  },
};
