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
  tagsJson?: string;
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
    return Array.isArray(x) ? x.map(String).slice(0, 20) : [];
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

function badgeClass(kind: "good" | "warn" | "bad") {
  if (kind === "bad") return "badge bad";
  if (kind === "warn") return "badge warn";
  return "badge good";
}

function kpiKind(value: number, which: "mood" | "stress" | "energy") {
  // quick visual heuristics
  if (which === "mood") {
    if (value <= 4) return "bad";
    if (value <= 6) return "warn";
    return "good";
  }
  if (which === "stress") {
    if (value >= 8) return "bad";
    if (value >= 6) return "warn";
    return "good";
  }
  // energy
  if (value <= 4) return "bad";
  if (value <= 6) return "warn";
  return "good";
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

  const role = auth?.role as Role | undefined;
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
  }, [isStaff]);

  function forceLogoutToLogin() {
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
      setTagsCsv("");
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
      <div className="container" style={{ paddingTop: 18 }}>
        <div className="card">
          <div className="hdr">
            <div>
              <h1>Loading</h1>
              <div className="sub">Getting your dashboard ready…</div>
            </div>
          </div>
          <div className="body">
            {error ? <div className="toast bad">{error}</div> : <div className="small">Loading…</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 18 }}>
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Dashboard</h1>
            <div className="sub">
              Org: <b>{org?.name || "—"}</b> • <span className="badge">Role: {auth.role}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link className="btn" to="/outlet">
              Counselor’s Office
            </Link>
            <button className="btn" onClick={() => refreshData()} disabled={loading || saving}>
              Refresh
            </button>
            <button
              className="btn danger"
              onClick={() => {
                setToken(null);
                nav("/login");
              }}
            >
              Log out
            </button>
          </div>
        </div>

        <div className="body">
          <div className="dashTabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`btn ${tab === t.id ? "primary" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error ? <div className="toast bad">{error}</div> : null}
          {loading ? <div className="toast">Loading…</div> : null}

          {tab === "checkin" ? (
            <div className="row" style={{ marginTop: 14 }}>
              <div className="col">
                <div className="panel">
                  <div className="panelTitle">
                    <span>Daily Check-in</span>
                    <span className="badge">Quick + honest</span>
                  </div>

                  <div style={{ marginTop: 12 }} className="dashSliders">
                    <div className="kpi">
                      <div className="small">Mood</div>
                      <div className="dashSliderRow">
                        <input
                          className="dashSlider"
                          type="range"
                          min={1}
                          max={10}
                          value={mood}
                          onChange={(e) => setMood(Number(e.target.value))}
                        />
                        <span className={`badge ${badgeClass(kpiKind(mood, "mood") as any)}`.replace("badge badge", "badge")}>
                          {mood}
                        </span>
                      </div>
                    </div>

                    <div className="kpi">
                      <div className="small">Energy</div>
                      <div className="dashSliderRow">
                        <input
                          className="dashSlider"
                          type="range"
                          min={1}
                          max={10}
                          value={energy}
                          onChange={(e) => setEnergy(Number(e.target.value))}
                        />
                        <span className={`badge ${badgeClass(kpiKind(energy, "energy") as any)}`.replace("badge badge", "badge")}>
                          {energy}
                        </span>
                      </div>
                    </div>

                    <div className="kpi">
                      <div className="small">Stress</div>
                      <div className="dashSliderRow">
                        <input
                          className="dashSlider"
                          type="range"
                          min={1}
                          max={10}
                          value={stress}
                          onChange={(e) => setStress(Number(e.target.value))}
                        />
                        <span className={`badge ${badgeClass(kpiKind(stress, "stress") as any)}`.replace("badge badge", "badge")}>
                          {stress}
                        </span>
                      </div>
                    </div>
                  </div>

                  <hr />

                  <div className="label">Quick tags</div>
                  <div className="dashChips">
                    {quickTags.map((t) => {
                      const active = parseTagsCSV(tagsCsv).includes(t);
                      return (
                        <button
                          key={t}
                          className={`chip ${active ? "active" : ""}`}
                          type="button"
                          onClick={() => toggleQuickTag(t)}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div className="label">Tags (comma separated)</div>
                    <input
                      className="input"
                      value={tagsCsv}
                      onChange={(e) => setTagsCsv(e.target.value)}
                      placeholder="workload, scheduling, conflict…"
                    />
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div className="label">Note (optional)</div>
                    <textarea
                      className="textarea"
                      rows={4}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="What happened today? What do you need?"
                    />
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                    <button className="btn primary" onClick={submitCheckin} disabled={saving}>
                      {saving ? "Saving…" : "Submit check-in"}
                    </button>
                    <button className="btn" onClick={() => setTab("history")} disabled={saving}>
                      View history
                    </button>
                  </div>
                </div>
              </div>

              <div className="col" style={{ flexBasis: 340 }}>
                <div className="panel">
                  <div className="panelTitle">
                    <span>Shortcuts</span>
                    <span className="badge good">MVP</span>
                  </div>

                  <div className="list">
                    <button className="listItem" onClick={() => setTab("habits")} type="button">
                      <div className="listTitle">Habits</div>
                      <div className="small">Track weekly targets + archive old habits.</div>
                    </button>

                    <Link className="listItem" to="/outlet">
                      <div className="listTitle">Counselor’s Office</div>
                      <div className="small">Private outlet + escalation (if needed).</div>
                    </Link>

                    <button className="listItem" onClick={() => setTab("patterns")} type="button">
                      <div className="listTitle">My Patterns</div>
                      <div className="small">Averages + streaks (30 days).</div>
                    </button>

                    {isStaff ? (
                      <button className="listItem" onClick={() => setTab("trends")} type="button">
                        <div className="listTitle">Program Trends</div>
                        <div className="small">Org-level view for staff.</div>
                      </button>
                    ) : null}

                    {isStaff ? (
                      <button className="listItem" onClick={() => setTab("org")} type="button">
                        <div className="listTitle">People & Roles</div>
                        <div className="small">Roster, notes, invites, exports.</div>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === "history" ? (
            <div style={{ marginTop: 14 }}>
              <div className="panel">
                <div className="panelTitle">
                  <span>History</span>
                  <span className="badge">{checkins.length} check-ins</span>
                </div>

                {!checkins.length ? (
                  <div className="small" style={{ marginTop: 12 }}>
                    No check-ins yet.
                  </div>
                ) : (
                  <div className="list" style={{ marginTop: 12 }}>
                    {checkins.map((c) => {
                      const tags = tagsFromTagsJson(c.tagsJson);
                      return (
                        <div key={c.id} className="listItemStatic">
                          <div className="listTop">
                            <div>
                              <div className="listTitle">{new Date(c.ts).toLocaleString()}</div>
                              <div className="small">
                                Mood <b>{c.mood}</b> • Energy <b>{c.energy}</b> • Stress <b>{c.stress}</b>
                              </div>
                            </div>
                            <div className="chips">
                              <button className="btn danger" onClick={() => deleteCheckin(c.id)} disabled={saving}>
                                Delete
                              </button>
                            </div>
                          </div>

                          {c.note ? (
                            <div className="bubbleText" style={{ marginTop: 10 }}>
                              {c.note}
                            </div>
                          ) : null}

                          {tags.length ? (
                            <div className="chips" style={{ marginTop: 10, justifyContent: "flex-start" }}>
                              {tags.map((t) => (
                                <span key={t} className="badge">
                                  {t}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {tab === "habits" ? (
            <div style={{ marginTop: 14 }}>
              <div className="panel">
                <div className="panelTitle">
                  <span>Habits</span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn primary" onClick={addHabit} disabled={saving}>
                      Add habit
                    </button>
                    <button className="btn" onClick={refreshData} disabled={loading || saving}>
                      Refresh
                    </button>
                  </div>
                </div>

                {!habits.length ? (
                  <div className="small" style={{ marginTop: 12 }}>
                    No habits yet.
                  </div>
                ) : (
                  <div className="list" style={{ marginTop: 12 }}>
                    {habits.map((h) => (
                      <div key={h.id} className="listItemStatic">
                        <div className="listTop">
                          <div>
                            <div className="listTitle">{h.name}</div>
                            <div className="small">Target/week: {h.targetPerWeek}</div>
                            {h.archivedAt ? <div className="small">Archived</div> : null}
                          </div>
                          <div className="chips">
                            {!h.archivedAt ? (
                              <button className="btn" onClick={() => archiveHabit(h.id)} disabled={saving}>
                                Archive
                              </button>
                            ) : (
                              <span className="badge">archived</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {tab === "patterns" ? <PatternsPanel setError={setError} /> : null}
          {tab === "trends" && isStaff ? <TrendsPanel setError={setError} /> : null}
          {tab === "org" && isStaff ? (
            <div style={{ marginTop: 14 }}>
              <OrgPanel role={auth.role as Role} myUserId={auth.userId} org={org} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PatternsPanel({ setError }: { setError: (s: string | null) => void }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="panel">
        <div className="panelTitle">
          <span>My Patterns</span>
          <span className="badge">30 days</span>
        </div>

        <div className="small" style={{ marginTop: 10 }}>
          Shows streak + averages (already supported by /api/analytics/summary).
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button
            className="btn primary"
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
          </button>
        </div>
      </div>
    </div>
  );
}

function TrendsPanel({ setError }: { setError: (s: string | null) => void }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div className="panel">
        <div className="panelTitle">
          <span>Program Trends</span>
          <span className="badge warn">Staff only</span>
        </div>

        <div className="small" style={{ marginTop: 10 }}>
          Uses /api/analytics/org-summary (aggregate only).
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button
            className="btn primary"
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
          </button>
        </div>
      </div>
    </div>
  );
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
      const tags = tagsFromTagsJson(selectedProfile.tagsJson);
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
    <div className="panel">
      <div className="panelTitle">
        <span>People & Roles</span>
        <span className="badge">Org: {org?.name || "—"}</span>
      </div>

      {msg ? <div className="toast">{msg}</div> : null}

      <div className="row" style={{ marginTop: 12 }}>
        <div className="col">
          <div className="panel">
            <div className="panelTitle">
              <span>Roster</span>
              <span className="badge">{users.length} users</span>
            </div>

            <div className="list" style={{ marginTop: 12 }}>
              {users.map((u) => (
                <div key={u.id} className="listItemStatic">
                  <div className="listTop">
                    <div>
                      <div className="listTitle">{u.username}</div>
                      <div className="small">Role: {u.role}</div>
                    </div>

                    <div className="chips">
                      {isAdmin ? (
                        <>
                          <button className="btn" onClick={() => changeRole(u.id, "user")} disabled={u.role === "user"}>
                            user
                          </button>
                          <button
                            className="btn"
                            onClick={() => changeRole(u.id, "manager")}
                            disabled={u.role === "manager"}
                          >
                            manager
                          </button>
                          <button className="btn" onClick={() => changeRole(u.id, "admin")} disabled={u.role === "admin"}>
                            admin
                          </button>
                        </>
                      ) : null}
                      <button className="btn primary" onClick={() => setSelectedId(u.id)}>
                        Open
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {!users.length ? <div className="small">No users.</div> : null}
            </div>
          </div>
        </div>

        <div className="col">
          <div className="panel">
            <div className="panelTitle">
              <span>User detail</span>
              <span className="badge">{selectedId ? "Selected" : "None"}</span>
            </div>

            {!selectedId ? (
              <div className="small" style={{ marginTop: 12 }}>
                Select a user from the roster.
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <div className="small">Selected: {users.find((u) => u.id === selectedId)?.username || selectedId}</div>

                <hr />

                <div className="label">Full name</div>
                <input
                  className="input"
                  value={selectedProfile?.fullName || ""}
                  onChange={(e) =>
                    setSelectedProfile((p) => ({ ...(p || { orgId: "", userId: selectedId }), fullName: e.target.value }))
                  }
                  placeholder="Full name"
                />

                <div className="row" style={{ marginTop: 10 }}>
                  <div className="col">
                    <div className="label">Email</div>
                    <input
                      className="input"
                      value={selectedProfile?.email || ""}
                      onChange={(e) =>
                        setSelectedProfile((p) => ({ ...(p || { orgId: "", userId: selectedId }), email: e.target.value }))
                      }
                      placeholder="Email"
                    />
                  </div>
                  <div className="col">
                    <div className="label">Phone</div>
                    <input
                      className="input"
                      value={selectedProfile?.phone || ""}
                      onChange={(e) =>
                        setSelectedProfile((p) => ({ ...(p || { orgId: "", userId: selectedId }), phone: e.target.value }))
                      }
                      placeholder="Phone"
                    />
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div className="label">Tags (comma separated)</div>
                  <input
                    className="input"
                    value={tagsFromTagsJson(selectedProfile?.tagsJson).join(", ")}
                    onChange={(e) =>
                      setSelectedProfile((p) => ({
                        ...(p || { orgId: "", userId: selectedId }),
                        tagsJson: JSON.stringify(parseTagsCSV(e.target.value)),
                      }))
                    }
                    placeholder="strengths, goals, support"
                  />
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                  <button className="btn primary" onClick={saveProfile}>
                    Save profile
                  </button>
                </div>

                {isStaff ? (
                  <>
                    <hr />
                    <div className="label">Staff notes</div>
                    <textarea
                      className="textarea"
                      rows={3}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add a note (staff only)…"
                    />
                    <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                      <button className="btn primary" onClick={addNote} disabled={!noteText.trim()}>
                        Add note
                      </button>
                    </div>

                    <div className="list" style={{ marginTop: 12 }}>
                      {selectedNotes.map((n) => (
                        <div key={n.id} className="listItemStatic">
                          <div className="small">{new Date(n.createdAt).toLocaleString()}</div>
                          <div style={{ marginTop: 6 }} className="bubbleText">
                            {n.note}
                          </div>
                        </div>
                      ))}
                      {!selectedNotes.length ? <div className="small">No notes yet.</div> : null}
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </div>

          {isAdmin ? (
            <div className="panel" style={{ marginTop: 14 }}>
              <div className="panelTitle">
                <span>Admin tools</span>
                <span className="badge warn">Admin only</span>
              </div>

              <div className="row" style={{ marginTop: 12 }}>
                <div className="col">
                  <div className="label">Exports</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      className="btn"
                      onClick={async () => {
                        try {
                          await downloadCsv("/api/export/users.csv", "users.csv");
                        } catch (e: any) {
                          setMsg(e?.message || "Export failed.");
                        }
                      }}
                    >
                      users.csv
                    </button>
                    <button
                      className="btn"
                      onClick={async () => {
                        try {
                          await downloadCsv("/api/export/checkins.csv?sinceDays=30", "checkins_30d.csv");
                        } catch (e: any) {
                          setMsg(e?.message || "Export failed.");
                        }
                      }}
                    >
                      checkins (30d)
                    </button>
                    <button
                      className="btn"
                      onClick={async () => {
                        try {
                          await downloadCsv("/api/export/checkins.csv?sinceDays=365", "checkins_365d.csv");
                        } catch (e: any) {
                          setMsg(e?.message || "Export failed.");
                        }
                      }}
                    >
                      checkins (365d)
                    </button>
                  </div>
                </div>

                <div className="col">
                  <div className="label">Invite link</div>
                  <div className="row">
                    <div className="col" style={{ flexBasis: 180 }}>
                      <select
                        className="select"
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as Role)}
                      >
                        <option value="user">user</option>
                        <option value="manager">manager</option>
                        <option value="admin">admin</option>
                      </select>
                    </div>
                    <div className="col" style={{ flexBasis: 160 }}>
                      <input
                        className="input"
                        value={inviteDays}
                        onChange={(e) => setInviteDays(e.target.value)}
                        placeholder="7"
                        type="number"
                      />
                    </div>
                    <div className="col" style={{ flexBasis: 160 }}>
                      <button className="btn primary" onClick={createInvite}>
                        Create
                      </button>
                    </div>
                  </div>

                  {inviteUrl ? (
                    <div className="toast" style={{ marginTop: 10 }}>
                      <div className="small">Invite URL</div>
                      <div className="bubbleText" style={{ marginTop: 6 }}>
                        {inviteUrl}
                      </div>
                      <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                        <button
                          className="btn"
                          onClick={() => {
                            navigator.clipboard.writeText(inviteUrl);
                            setMsg("Invite link copied.");
                          }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <hr />

              <div className="label">Password reset token</div>
              <div className="row">
                <div className="col">
                  <select className="select" value={resetUserId} onChange={(e) => setResetUserId(e.target.value)}>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col" style={{ flexBasis: 180 }}>
                  <button className="btn primary" onClick={generateReset}>
                    Generate
                  </button>
                </div>
              </div>

              {resetToken ? (
                <div className="toast" style={{ marginTop: 10 }}>
                  <div className="small">Reset token</div>
                  <div className="bubbleText" style={{ marginTop: 6 }}>
                    {resetToken}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                    <button
                      className="btn"
                      onClick={() => {
                        navigator.clipboard.writeText(resetToken);
                        setMsg("Reset token copied.");
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="small" style={{ marginTop: 10 }}>
                Security note: tokens shown on-screen are “demo-friendly”. Production would email/SMS them.
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
