// client/src/ui/DashboardPage.tsx (FULL REPLACEMENT - matches client/src/ui/styles.css)

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AuthPayload, Role } from "../lib/api";
import { api, apiGet, apiPost, getToken, setToken } from "../lib/api";

type Org = { id: string; name: string };

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
  tagsJson?: string; // backend: stringified JSON
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
    return Array.isArray(x) ? x.map(String) : [];
  } catch {
    return [];
  }
}

function badgeForScore(label: string, n: number) {
  // simple cosmetics
  if (label === "Stress") {
    if (n >= 8) return "badge bad";
    if (n >= 5) return "badge warn";
    return "badge good";
  } else {
    if (n >= 8) return "badge good";
    if (n >= 5) return "badge warn";
    return "badge bad";
  }
}

export default function DashboardPage() {
  const nav = useNavigate();

  const [auth, setAuth] = useState<AuthPayload | null>(null);
  const [org, setOrg] = useState<Org | null>(null);

  const role = auth?.role as Role | undefined;
  const isStaff = role === "admin" || role === "manager";

  const [tab, setTab] = useState<"checkin" | "history" | "habits" | "patterns">("checkin");

  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Check-in form
  const [mood, setMood] = useState(7);
  const [energy, setEnergy] = useState(6);
  const [stress, setStress] = useState(4);
  const [note, setNote] = useState("");
  const [tagsCsv, setTagsCsv] = useState("");

  const quickTags = ["workload", "scheduling", "conflict", "pay", "customers", "fatigue", "safety"];

  const tabs = useMemo(() => {
    const base = [
      { id: "checkin" as const, label: "Check-in" },
      { id: "history" as const, label: "History" },
      { id: "habits" as const, label: "Habits" },
      { id: "patterns" as const, label: "My Patterns" },
    ];
    return base;
  }, []);

  function forceLogout() {
    setToken(null);
    setAuth(null);
    nav("/login");
  }

  async function refresh() {
    setMsg(null);
    try {
      const [c, h] = await Promise.all([api.listCheckins(200), api.listHabits(false)]);
      setCheckins((c.checkins || []) as any);
      setHabits((h.habits || []) as any);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load dashboard data.");
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const me = await apiGet<{ auth: AuthPayload }>("/api/me");
        setAuth(me.auth);

        const o = await apiGet<{ org: Org }>("/api/org");
        setOrg(o.org);

        setLoading(false);
      } catch {
        setLoading(false);
        forceLogout();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auth) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.userId]);

  async function submitCheckin() {
    setSaving(true);
    setMsg(null);
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
      await refresh();
      setTab("history");
      setMsg("Check-in saved.");
    } catch (e: any) {
      setMsg(e?.message || "Failed to submit check-in.");
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
    setMsg(null);
    try {
      await api.createHabit({ name: name.trim(), targetPerWeek: target });
      await refresh();
      setTab("habits");
      setMsg("Habit added.");
    } catch (e: any) {
      setMsg(e?.message || "Failed to create habit.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveHabit(id: string) {
    if (!confirm("Archive this habit?")) return;
    setSaving(true);
    setMsg(null);
    try {
      await api.archiveHabit(id);
      await refresh();
      setMsg("Habit archived.");
    } catch (e: any) {
      setMsg(e?.message || "Failed to archive habit.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCheckin(id: string) {
    if (!confirm("Delete this check-in?")) return;
    setSaving(true);
    setMsg(null);
    try {
      await api.deleteCheckin(id);
      await refresh();
      setMsg("Check-in deleted.");
    } catch (e: any) {
      setMsg(e?.message || "Failed to delete check-in.");
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

  if (!getToken()) {
    return (
      <div className="container">
        <div className="card">
          <div className="hdr">
            <div>
              <h1>Level Up</h1>
              <div className="sub">Please log in.</div>
            </div>
            <Link className="btn primary" to="/login">
              Log in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !auth) {
    return (
      <div className="container">
        <div className="card">
          <div className="hdr">
            <div>
              <h1>Dashboard</h1>
              <div className="sub">Loading…</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Dashboard</h1>
            <div className="sub">
              Org: <b>{org?.name || "—"}</b> • Role: <b>{auth.role}</b>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link className="btn" to="/outlet">
              Counselor’s Office
            </Link>
            {isStaff ? (
              <Link className="btn" to="/dashboard">
                Staff view
              </Link>
            ) : null}
            <button className="btn danger" onClick={forceLogout}>
              Log out
            </button>
          </div>
        </div>

        <div className="body">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`btn ${tab === t.id ? "primary" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
            <button className="btn" onClick={refresh} disabled={saving}>
              Refresh
            </button>
          </div>

          {msg ? <div className="toast" style={{ marginTop: 12 }}>{msg}</div> : null}

          <div className="row" style={{ marginTop: 14 }}>
            {/* LEFT */}
            <div className="col">
              {tab === "checkin" ? (
                <div className="panel">
                  <div className="panelTitle">
                    <span>Check-in</span>
                    <span className="badge">Today</span>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div className="row">
                      <div className="col" style={{ flexBasis: 220 }}>
                        <div className="label">Mood</div>
                        <div className={badgeForScore("Mood", mood)}>{mood}/10</div>
                        <input
                          style={{ width: "100%", marginTop: 8 }}
                          type="range"
                          min={1}
                          max={10}
                          value={mood}
                          onChange={(e) => setMood(Number(e.target.value))}
                        />
                      </div>

                      <div className="col" style={{ flexBasis: 220 }}>
                        <div className="label">Energy</div>
                        <div className={badgeForScore("Energy", energy)}>{energy}/10</div>
                        <input
                          style={{ width: "100%", marginTop: 8 }}
                          type="range"
                          min={1}
                          max={10}
                          value={energy}
                          onChange={(e) => setEnergy(Number(e.target.value))}
                        />
                      </div>

                      <div className="col" style={{ flexBasis: 220 }}>
                        <div className="label">Stress</div>
                        <div className={badgeForScore("Stress", stress)}>{stress}/10</div>
                        <input
                          style={{ width: "100%", marginTop: 8 }}
                          type="range"
                          min={1}
                          max={10}
                          value={stress}
                          onChange={(e) => setStress(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <hr />

                    <div className="label">Quick tags</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {quickTags.map((t) => {
                        const active = parseTagsCSV(tagsCsv).includes(t);
                        return (
                          <button
                            key={t}
                            className={`btn ${active ? "good" : ""}`}
                            onClick={() => toggleQuickTag(t)}
                            type="button"
                            style={{ padding: "8px 10px" }}
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

                    <div className="small" style={{ marginTop: 10 }}>
                      Tip: keep it short. Consistency beats perfection.
                    </div>
                  </div>
                </div>
              ) : null}

              {tab === "history" ? (
                <div className="panel">
                  <div className="panelTitle">
                    <span>History</span>
                    <span className="badge">{checkins.length} check-ins</span>
                  </div>

                  <div className="list">
                    {checkins.length === 0 ? (
                      <div className="small">No check-ins yet.</div>
                    ) : (
                      checkins.map((c) => {
                        const tags = tagsFromTagsJson(c.tagsJson);
                        return (
                          <div key={c.id} className="listItemStatic">
                            <div className="listTop">
                              <div>
                                <div className="listTitle">{new Date(c.ts).toLocaleString()}</div>
                                <div className="small">
                                  Mood <b>{c.mood}</b> • Energy <b>{c.energy}</b> • Stress <b>{c.stress}</b>
                                </div>
                                {c.note ? (
                                  <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{c.note}</div>
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

                              <div className="chips">
                                <button className="btn danger" onClick={() => deleteCheckin(c.id)} disabled={saving}>
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}

              {tab === "habits" ? (
                <div className="panel">
                  <div className="panelTitle">
                    <span>Habits</span>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn primary" onClick={addHabit} disabled={saving}>
                        Add habit
                      </button>
                      <button className="btn" onClick={refresh} disabled={saving}>
                        Refresh
                      </button>
                    </div>
                  </div>

                  <div className="list">
                    {habits.length === 0 ? (
                      <div className="small">No habits yet.</div>
                    ) : (
                      habits.map((h) => (
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
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              {tab === "patterns" ? (
                <div className="panel">
                  <div className="panelTitle">
                    <span>My Patterns</span>
                    <span className="badge">30 days</span>
                  </div>

                  <div className="small" style={{ marginTop: 10 }}>
                    This reads your existing endpoint: <code>/api/analytics/summary</code>
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                    <button
                      className="btn primary"
                      onClick={async () => {
                        setMsg(null);
                        try {
                          const r = await api.summary(30);
                          const s = r.summary;
                          alert(
                            `Last ${s.days} days\n` +
                              `Streak: ${s.streak}\n` +
                              `Mood avg: ${s.overall.moodAvg ?? "—"}\n` +
                              `Energy avg: ${s.overall.energyAvg ?? "—"}\n` +
                              `Stress avg: ${s.overall.stressAvg ?? "—"}`,
                          );
                        } catch (e: any) {
                          setMsg(e?.message || "Failed to load summary.");
                        }
                      }}
                    >
                      View 30-day summary
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* RIGHT */}
            <div className="col" style={{ flexBasis: 360 }}>
              <div className="panel">
                <div className="panelTitle">
                  <span>Quick stats</span>
                  <span className="badge">Latest</span>
                </div>

                <div className="row" style={{ marginTop: 12 }}>
                  <div className="col" style={{ flexBasis: 160 }}>
                    <div className="kpi">
                      <div className="small">Check-ins</div>
                      <div className="num">{checkins.length}</div>
                    </div>
                  </div>
                  <div className="col" style={{ flexBasis: 160 }}>
                    <div className="kpi">
                      <div className="small">Habits</div>
                      <div className="num">{habits.filter((h) => !h.archivedAt).length}</div>
                    </div>
                  </div>
                </div>

                <hr />

                <div className="small">
                  If the dashboard ever looks “unstyled” again, it usually means Tailwind classes got added somewhere
                  without Tailwind installed. This file stays aligned with <b>ui/styles.css</b>.
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link className="btn" to="/outlet">
                    Go to Counselor’s Office
                  </Link>
                  <button className="btn" onClick={() => apiPost("/api/health", {}).catch(() => {})}>
                    Ping backend
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="small" style={{ marginTop: 14 }}>
            You’re safe: switching UI code won’t delete your data. Data lives in your DB, not in these components.
          </div>
        </div>
      </div>
    </div>
  );
}
