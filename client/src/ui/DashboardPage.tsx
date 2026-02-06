// client/src/ui/DashboardPage.tsx (FULL REPLACEMENT)

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AuthPayload, Role } from "../lib/api";
import { api, apiGet, apiPost, apiPut, getToken, setToken } from "../lib/api";

type Org = { id: string; name: string };
type User = { id: string; username: string; role: Role; orgId: string };
type Profile = {
  orgId: string;
  userId: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  tags?: string[];
};
type Note = {
  id: string;
  orgId: string;
  userId: string;
  authorId: string;
  note: string;
  createdAt: string;
};

type CheckIn = {
  id: string;
  orgId: string;
  userId: string;
  ts: string;
  dayKey: string;
  mood: number;
  energy: number;
  stress: number;
  note?: string | null;
  tagsJson?: string; // backend returns tagsJson (stringified JSON)
};

type Habit = {
  id: string;
  orgId: string;
  userId: string;
  name: string;
  targetPerWeek: number;
  archivedAt?: string | null;
};

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-white/60">{subtitle}</div> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
      {children}
    </span>
  );
}

function Button({
  children,
  onClick,
  type = "button",
  disabled,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: "primary" | "ghost";
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition border";
  const styles =
    variant === "primary"
      ? "border-white/10 bg-white/10 hover:bg-white/15 text-white disabled:opacity-50"
      : "border-transparent bg-transparent hover:bg-white/10 text-white/80 disabled:opacity-50";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20"
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-black">
          {o.label}
        </option>
      ))}
    </select>
  );
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function parseTagsCSV(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function tagsFromTagsJson(tagsJson?: string): string[] {
  if (!tagsJson) return [];
  try {
    const x = JSON.parse(tagsJson);
    return Array.isArray(x) ? x.map(String) : [];
  } catch {
    return [];
  }
}

function apiBase() {
  return ((import.meta as any)?.env?.VITE_API_BASE || "").toString().replace(/\/+$/, "");
}
function withBase(path: string) {
  const base = apiBase();
  if (!base) return path;
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

async function downloadCsv(path: string, filename: string) {
  const token = getToken() || "";
  const res = await fetch(withBase(path), {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    if (res.status === 403) throw new Error("Forbidden: your role cannot export.");
    throw new Error(`Export failed (${res.status}). ${txt || ""}`.trim());
  }

  const blob = await res.blob();
  const dlUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = dlUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(dlUrl);
}

export default function DashboardPage() {
  const nav = useNavigate();

  const [auth, setAuthState] = useState<AuthPayload | null>(null);
  const [org, setOrg] = useState<Org | null>(null);

  const [tab, setTab] = useState<"checkin" | "history" | "habits" | "patterns" | "org" | "trends">(
    "checkin",
  );

  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check-in form state
  const [mood, setMood] = useState(7);
  const [energy, setEnergy] = useState(6);
  const [stress, setStress] = useState(4);
  const [note, setNote] = useState("");
  const [tagsCsv, setTagsCsv] = useState("");
  const quickTags = ["workload", "scheduling", "conflict", "pay", "customers", "fatigue", "safety"];

  const role = auth?.role;
  const isStaff = role === "admin" || role === "manager";
  const isAdmin = role === "admin";

  const tabs = useMemo(() => {
    const base: { id: typeof tab; label: string }[] = [
      { id: "checkin", label: "Check-in" },
      { id: "history", label: "History" },
      { id: "habits", label: "Habits" },
      { id: "patterns", label: "My Patterns" },
    ];
    if (isStaff) base.push({ id: "trends", label: "Program Trends" });
    if (isStaff) base.push({ id: "org", label: "People & Roles" });
    return base;
  }, [isStaff, tab]);

  function forceLogoutToLogin() {
    // clear storage via shared helper + go to login
    setToken(null);
    setAuthState(null);
    nav("/login");
  }

  async function refreshData() {
    try {
      setLoading(true);
      setError(null);

      const [c, h] = await Promise.all([api.listCheckins(200), api.listHabits(false)]);
      setCheckins((c.checkins || []) as any);
      setHabits((h.habits || []) as any);
    } catch (e: any) {
      setError(e?.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const me = await apiGet<{ auth: AuthPayload }>("/api/me");
        setAuthState(me.auth);

        const o = await apiGet<{ org: Org }>("/api/org");
        setOrg(o.org);
      } catch (e: any) {
        // token missing/invalid OR /api/me not implemented
        const msg = (e?.message || "").toLowerCase();
        const looksLikeMissingMe =
          msg.includes("not found") || msg.includes("404") || msg.includes("cannot") || msg.includes("route");
        if (looksLikeMissingMe) {
          setError("Backend missing /api/me. Paste server/routes.ts next so we can add it.");
          return;
        }
        setError(null);
        forceLogoutToLogin();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auth) return;
    refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.userId]);

  function logout() {
    forceLogoutToLogin();
  }

  async function submitCheckin() {
    setSaving(true);
    setError(null);

    try {
      const tags = parseTagsCSV(tagsCsv);

      await api.createCheckin({
        mood: clamp(mood, 1, 10),
        energy: clamp(energy, 1, 10),
        stress: clamp(stress, 1, 10),
        note: note.trim() ? note.trim() : undefined,
        tags: tags.length ? tags : undefined,
      });

      setNote("");
      await refreshData();
      setTab("history");
    } catch (e: any) {
      setError(e?.message || "Failed to submit check-in.");
    } finally {
      setSaving(false);
    }
  }

  async function addHabit() {
    const name = prompt("Habit name (e.g., 'Drink water'):");
    if (!name?.trim()) return;

    const targetRaw = prompt("Target per week (1-14):", "5");
    const target = clamp(Number(targetRaw || "5"), 1, 14);

    setSaving(true);
    setError(null);
    try {
      await api.createHabit({ name: name.trim(), targetPerWeek: target });
      await refreshData();
      setTab("habits");
    } catch (e: any) {
      setError(e?.message || "Failed to create habit.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveHabit(id: string) {
    if (!confirm("Archive this habit?")) return;
    setSaving(true);
    setError(null);
    try {
      await api.archiveHabit(id);
      await refreshData();
    } catch (e: any) {
      setError(e?.message || "Failed to archive habit.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCheckin(id: string) {
    if (!confirm("Delete this check-in?")) return;
    setSaving(true);
    setError(null);
    try {
      await api.deleteCheckin(id);
      await refreshData();
    } catch (e: any) {
      setError(e?.message || "Failed to delete check-in.");
    } finally {
      setSaving(false);
    }
  }

  function toggleQuickTag(t: string) {
    const cur = new Set(parseTagsCSV(tagsCsv));
    if (cur.has(t)) cur.delete(t);
    else cur.add(t);
    setTagsCsv(Array.from(cur).join(", "));
  }

  if (!auth) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-emerald-950 text-white">
        <div className="mx-auto max-w-5xl px-4 py-10">
          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : (
            <div className="text-white/60">Loading…</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-emerald-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div>
            <div className="text-xl font-semibold">Level Up</div>
            <div className="mt-1 text-sm text-white/60">Daily structure • habits • honest reflection</div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/about" className="text-sm text-white/70 hover:text-white">
              About
            </Link>
            <Pill>Role: {auth.role}</Pill>
            <Button variant="ghost" onClick={() => setTab("checkin")}>
              Dashboard
            </Button>
            <Button variant="ghost" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Dashboard</div>
              <div className="mt-1 text-sm text-white/60">Build self-trust through repetition.</div>
            </div>

            <div className="flex flex-wrap gap-2">
              {tabs.map((t) => (
                <Button
                  key={t.id}
                  variant={tab === t.id ? "primary" : "ghost"}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            Loading…
          </div>
        ) : null}

        {!loading && tab === "org" && isStaff ? (
          <div className="mt-6">
            <OrgPanel role={auth.role} myUserId={auth.userId} org={org} />
          </div>
        ) : null}

        {!loading && tab !== "org" ? (
          <div className="mt-6 grid gap-4">
            {tab === "checkin" ? <CheckInPanel /> : null}
            {tab === "history" ? <HistoryPanel /> : null}
            {tab === "habits" ? <HabitsPanel /> : null}
            {tab === "patterns" ? <PatternsPanel /> : null}
            {tab === "trends" && isStaff ? <TrendsPanel /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );

  // ---------------- Panels
  // ----------------

  function CheckInPanel() {
    return (
      <Card title="Check in" subtitle="Show up. Check in. Adjust. Repeat.">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/70">Mood</div>
              <Pill>{mood}</Pill>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={mood}
              onChange={(e) => setMood(Number(e.target.value))}
              className="w-full"
            />

            <div className="flex items-center justify-between mt-2">
              <div className="text-sm text-white/70">Energy</div>
              <Pill>{energy}</Pill>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={energy}
              onChange={(e) => setEnergy(Number(e.target.value))}
              className="w-full"
            />

            <div className="flex items-center justify-between mt-2">
              <div className="text-sm text-white/70">Stress</div>
              <Pill>{stress}</Pill>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={stress}
              onChange={(e) => setStress(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="grid gap-2">
            <div className="text-xs text-white/60">Quick tags</div>
            <div className="flex flex-wrap gap-2">
              {quickTags.map((t) => {
                const active = parseTagsCSV(tagsCsv).includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleQuickTag(t)}
                    className={
                      "rounded-full border px-3 py-1 text-xs transition " +
                      (active
                        ? "border-white/20 bg-white/15 text-white"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10")
                    }
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <div className="text-xs text-white/60">Tags (comma separated)</div>
            <Input value={tagsCsv} onChange={setTagsCsv} placeholder="workload, scheduling, conflict…" />
          </div>

          <div className="grid gap-2">
            <div className="text-xs text-white/60">Note (optional)</div>
            <TextArea value={note} onChange={setNote} placeholder="What happened today? What do you need?" />
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={submitCheckin} disabled={saving}>
              {saving ? "Saving…" : "Submit check-in"}
            </Button>
            <Button variant="ghost" onClick={refreshData} disabled={loading || saving}>
              Refresh
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  function HistoryPanel() {
    return (
      <Card title="History" subtitle="Your recent check-ins.">
        {checkins.length === 0 ? (
          <div className="text-sm text-white/60">No check-ins yet.</div>
        ) : (
          <div className="grid gap-3">
            {checkins.map((c) => {
              const tags = tagsFromTagsJson(c.tagsJson);
              return (
                <div key={c.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm text-white/60">{new Date(c.ts).toLocaleString()}</div>
                      <div className="mt-1 text-sm">
                        Mood <b>{c.mood}</b> • Energy <b>{c.energy}</b> • Stress <b>{c.stress}</b>
                      </div>
                      {c.note ? <div className="mt-2 text-sm text-white/80 whitespace-pre-wrap">{c.note}</div> : null}
                      {tags.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {tags.map((t) => (
                            <Pill key={t}>{t}</Pill>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <Button variant="ghost" onClick={() => deleteCheckin(c.id)} disabled={saving}>
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    );
  }

  function HabitsPanel() {
    return (
      <Card title="Habits" subtitle="Track the reps.">
        <div className="flex items-center gap-2">
          <Button onClick={addHabit} disabled={saving}>
            Add habit
          </Button>
          <Button variant="ghost" onClick={refreshData} disabled={loading || saving}>
            Refresh
          </Button>
        </div>

        <div className="mt-4 grid gap-3">
          {habits.length === 0 ? (
            <div className="text-sm text-white/60">No habits yet.</div>
          ) : (
            habits.map((h) => (
              <div key={h.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{h.name}</div>
                    <div className="text-xs text-white/60">Target/week: {h.targetPerWeek}</div>
                    {h.archivedAt ? <div className="text-xs text-white/40">Archived</div> : null}
                  </div>
                  {!h.archivedAt ? (
                    <Button variant="ghost" onClick={() => archiveHabit(h.id)} disabled={saving}>
                      Archive
                    </Button>
                  ) : (
                    <Pill>archived</Pill>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    );
  }

  function PatternsPanel() {
    return (
      <Card title="My Patterns" subtitle="Quick summary (30 days).">
        <div className="text-sm text-white/60">
          This panel can show averages + streaks (already supported by /api/analytics/summary).
        </div>
        <div className="mt-3">
          <Button
            onClick={async () => {
              setError(null);
              try {
                const r = await api.summary(30);
                const s = r.summary;
                alert(
                  `Last ${s.days} days\nStreak: ${s.streak}\nMood avg: ${s.overall.moodAvg ?? "—"}\nEnergy avg: ${
                    s.overall.energyAvg ?? "—"
                  }\nStress avg: ${s.overall.stressAvg ?? "—"}`,
                );
              } catch (e: any) {
                setError(e?.message || "Failed to load summary.");
              }
            }}
          >
            View 30-day summary
          </Button>
        </div>
      </Card>
    );
  }

  function TrendsPanel() {
    return (
      <Card title="Program Trends" subtitle="Staff-only aggregate view (30 days).">
        <div className="text-sm text-white/60">
          Uses /api/analytics/org-summary. This is safe, fast, and anonymous at the aggregate level.
        </div>
        <div className="mt-3">
          <Button
            onClick={async () => {
              setError(null);
              try {
                const r = await api.orgSummary(30);
                const s = r.summary;
                alert(
                  `Org (last ${s.days} days)\nUsers: ${s.overall.users}\nCheck-ins: ${s.overall.checkins}\nMood avg: ${
                    s.overall.moodAvg ?? "—"
                  }\nEnergy avg: ${s.overall.energyAvg ?? "—"}\nStress avg: ${s.overall.stressAvg ?? "—"}`,
                );
              } catch (e: any) {
                setError(e?.message || "Failed to load org summary.");
              }
            }}
          >
            View org summary
          </Button>
        </div>
      </Card>
    );
  }
}

function OrgPanel({
  role,
  myUserId,
  org,
}: {
  role: Role;
  myUserId: string;
  org: { id: string; name: string } | null;
}) {
  const isAdmin = role === "admin";
  const isStaff = role === "admin" || role === "manager";

  const [users, setUsers] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("user");
  const [inviteDays, setInviteDays] = useState("7");
  const [inviteUrl, setInviteUrl] = useState<string>("");
  const [resetUserId, setResetUserId] = useState<string>(myUserId);
  const [resetToken, setResetToken] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiGet<{ users: User[] }>("/api/users");
        setUsers(r.users || []);
        if (!selectedId && r.users?.length) setSelectedId(r.users[0].id);
      } catch (e: any) {
        setMsg(e?.message || "Failed to load users.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      try {
        const p = await apiGet<{ profile: Profile | null }>(`/api/users/${selectedId}/profile`);
        setSelectedProfile(p.profile);
      } catch {
        setSelectedProfile(null);
      }

      if (isStaff) {
        try {
          const n = await apiGet<{ notes: Note[] }>(`/api/users/${selectedId}/notes?limit=100`);
          setSelectedNotes(n.notes || []);
        } catch {
          setSelectedNotes([]);
        }
      }
    })();
  }, [selectedId, isStaff]);

  async function changeRole(userId: string, nextRole: Role) {
    setMsg(null);
    try {
      await apiPost("/api/users/role", { userId, role: nextRole });
      const r = await apiGet<{ users: User[] }>("/api/users");
      setUsers(r.users || []);
    } catch (e: any) {
      setMsg(e?.message || "Role change failed.");
    }
  }

  async function createInvite() {
    setMsg(null);
    setInviteUrl("");
    try {
      const days = Number(inviteDays);
      const r = await apiPost<{ invite: any; urlPath: string }>("/api/admin/invites", {
        role: inviteRole,
        expiresInDays: days,
      });

      const API_BASE = ((import.meta as any)?.env?.VITE_API_BASE || "").toString().replace(/\/+$/, "");
      const base = API_BASE || location.origin;

      setInviteUrl(`${base}${r.urlPath}`);
    } catch (e: any) {
      setMsg(e?.message || "Invite creation failed.");
    }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    setMsg(null);
    try {
      await apiPost(`/api/users/${selectedId}/notes`, { note: noteText.trim() });
      setNoteText("");
      const n = await apiGet<{ notes: Note[] }>(`/api/users/${selectedId}/notes?limit=100`);
      setSelectedNotes(n.notes || []);
    } catch (e: any) {
      setMsg(e?.message || "Note add failed.");
    }
  }

  async function generateReset() {
    setMsg(null);
    setResetToken("");
    try {
      const r = await apiPost<{ reset: { token: string; expiresAt: string } }>(
        `/api/admin/users/${resetUserId}/reset-token`,
        { expiresInMinutes: 60 },
      );
      setResetToken(r.reset.token);
    } catch (e: any) {
      setMsg(e?.message || "Reset token failed.");
    }
  }

  async function saveProfile() {
    if (!selectedProfile) return;
    setMsg(null);
    try {
      const tags = selectedProfile.tags || [];
      await apiPut(`/api/users/${selectedId}/profile`, {
        fullName: selectedProfile.fullName ?? null,
        email: selectedProfile.email ?? null,
        phone: selectedProfile.phone ?? null,
        tags,
      });
      setMsg("Saved.");
    } catch (e: any) {
      setMsg(e?.message || "Save failed.");
    }
  }

  return (
    <div className="grid gap-4">
      <Card title="People & tools" subtitle={`Org: ${org?.name || "—"}`}>
        <div className="flex items-center justify-between">
          <div />
          <Pill>Role: {role}</Pill>
        </div>

        {msg ? (
          <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">{msg}</div>
        ) : null}

        {isAdmin ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold">Exports</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  onClick={async () => {
                    try {
                      await downloadCsv("/api/export/users.csv", "users.csv");
                    } catch (e: any) {
                      setMsg(e?.message || "Export failed.");
                    }
                  }}
                >
                  Download users.csv
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      await downloadCsv("/api/export/checkins.csv?sinceDays=30", "checkins_30d.csv");
                    } catch (e: any) {
                      setMsg(e?.message || "Export failed.");
                    }
                  }}
                >
                  Check-ins (30d)
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      await downloadCsv("/api/export/checkins.csv?sinceDays=365", "checkins_365d.csv");
                    } catch (e: any) {
                      setMsg(e?.message || "Export failed.");
                    }
                  }}
                >
                  Check-ins (365d)
                </Button>
              </div>
              <div className="mt-2 text-xs text-white/50">CSV downloads for reporting.</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold">Invite link</div>
              <div className="mt-3 grid gap-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <div className="text-xs text-white/60">Role</div>
                    <Select
                      value={inviteRole}
                      onChange={(v) => setInviteRole(v as Role)}
                      options={[
                        { value: "user", label: "user" },
                        { value: "manager", label: "manager" },
                        { value: "admin", label: "admin" },
                      ]}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-white/60">Expires (days)</div>
                    <Input value={inviteDays} onChange={setInviteDays} placeholder="7" type="number" />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={createInvite}>Create link</Button>
                  {inviteUrl ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(inviteUrl);
                        setMsg("Invite link copied.");
                      }}
                    >
                      Copy
                    </Button>
                  ) : null}
                </div>

                {inviteUrl ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-xs text-white/70 break-all">
                    {inviteUrl}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Admin-only tools</div>
            <div className="mt-2 text-sm text-white/60">
              Exports, invite links, and password resets are admin-only in this build.
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">My profile</div>
            <div className="mt-2 text-xs text-white/50">This is for contact + context. Keep it simple.</div>

            <div className="mt-3 grid gap-2">
              <div className="grid gap-2 md:grid-cols-3">
                <div>
                  <div className="text-xs text-white/60">Full name</div>
                  <Input
                    value={selectedProfile?.fullName || ""}
                    onChange={(v) =>
                      setSelectedProfile((p) => ({ ...(p || { orgId: "", userId: selectedId }), fullName: v }))
                    }
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <div className="text-xs text-white/60">Email</div>
                  <Input
                    value={selectedProfile?.email || ""}
                    onChange={(v) =>
                      setSelectedProfile((p) => ({ ...(p || { orgId: "", userId: selectedId }), email: v }))
                    }
                    placeholder="Email"
                  />
                </div>
                <div>
                  <div className="text-xs text-white/60">Phone</div>
                  <Input
                    value={selectedProfile?.phone || ""}
                    onChange={(v) =>
                      setSelectedProfile((p) => ({ ...(p || { orgId: "", userId: selectedId }), phone: v }))
                    }
                    placeholder="Phone"
                  />
                </div>
              </div>

              <div>
                <div className="text-xs text-white/60">Tags (comma separated)</div>
                <Input
                  value={(selectedProfile?.tags || []).join(", ")}
                  onChange={(v) =>
                    setSelectedProfile((p) => ({
                      ...(p || { orgId: "", userId: selectedId }),
                      tags: parseTagsCSV(v),
                    }))
                  }
                  placeholder="strengths, goals, support"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={saveProfile}>Save profile</Button>
              </div>
            </div>
          </div>

          {isAdmin ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold">Password reset (admin)</div>
              <div className="mt-2 text-xs text-white/50">Generates a temporary reset token (demo: shown on screen).</div>

              <div className="mt-3 grid gap-2">
                <div>
                  <div className="text-xs text-white/60">User</div>
                  <Select
                    value={resetUserId}
                    onChange={setResetUserId}
                    options={users.map((u) => ({ value: u.id, label: `${u.username} (${u.role})` }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={generateReset}>Generate token</Button>
                  {resetToken ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(resetToken);
                        setMsg("Reset token copied.");
                      }}
                    >
                      Copy
                    </Button>
                  ) : null}
                </div>
                {resetToken ? (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-2 text-xs text-white/70 break-all">
                    {resetToken}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Roster</div>
            <div className="mt-2 text-xs text-white/50">Click a user to view profile + (staff) notes.</div>

            <div className="mt-3 divide-y divide-white/10">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <div className="text-sm font-medium">{u.username}</div>
                    <div className="text-xs text-white/60">Role: {u.role}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isAdmin ? (
                      <>
                        <Button variant="ghost" onClick={() => changeRole(u.id, "user")} disabled={u.role === "user"}>
                          user
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => changeRole(u.id, "manager")}
                          disabled={u.role === "manager"}
                        >
                          manager
                        </Button>
                        <Button variant="ghost" onClick={() => changeRole(u.id, "admin")} disabled={u.role === "admin"}>
                          admin
                        </Button>
                      </>
                    ) : null}
                    <Button variant="ghost" onClick={() => setSelectedId(u.id)}>
                      Open
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">User detail</div>
            <div className="mt-2 text-xs text-white/50">Select a user from the roster.</div>

            {selectedId ? (
              <div className="mt-3 grid gap-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/70">
                  Selected: {users.find((u) => u.id === selectedId)?.username || selectedId}
                </div>

                {isStaff ? (
                  <div className="grid gap-2">
                    <div className="text-xs text-white/60">Staff notes</div>
                    <TextArea value={noteText} onChange={setNoteText} placeholder="Add a note (staff only)..." />
                    <div className="flex gap-2">
                      <Button onClick={addNote} disabled={!noteText.trim()}>
                        Add note
                      </Button>
                    </div>

                    <div className="mt-2 space-y-2">
                      {selectedNotes.map((n) => (
                        <div
                          key={n.id}
                          className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-white/70"
                        >
                          <div className="text-white/50">{new Date(n.createdAt).toLocaleString()}</div>
                          <div className="mt-1">{n.note}</div>
                        </div>
                      ))}
                      {!selectedNotes.length ? <div className="text-xs text-white/50">No notes yet.</div> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 text-sm text-white/60">No user selected.</div>
            )}
          </div>
        </div>

        <div className="mt-4 text-xs text-white/45">
          Security note: password resets and invites are “demo-friendly” in this build (tokens are shown on screen). In a
          production build, you’d deliver tokens via email/SMS.
        </div>
      </Card>
    </div>
  );
}
