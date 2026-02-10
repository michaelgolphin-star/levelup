// client/src/ui/DashboardPage.tsx (FULL REPLACEMENT)

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AuthPayload, CheckIn, Habit, OrgSummary, Summary } from "../lib/api";
import { api, apiGet } from "../lib/api";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function DashboardPage() {
  const nav = useNavigate();

  const [auth, setAuth] = useState<AuthPayload | null>(null);
  const isStaff = auth?.role === "admin" || auth?.role === "manager";

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "good" | "bad"; text: string } | null>(null);

  // Check-in form
  const [mood, setMood] = useState(7);
  const [energy, setEnergy] = useState(7);
  const [stress, setStress] = useState(5);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [savingCheckin, setSavingCheckin] = useState(false);

  // Data
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [orgSummary, setOrgSummary] = useState<OrgSummary | null>(null);

  const [days, setDays] = useState(30);

  async function loadAuth() {
    const me = await apiGet<{ auth: AuthPayload }>("/api/me");
    setAuth(me.auth);
  }

  async function bootstrap() {
    setToast(null);
    setLoading(true);
    try {
      await loadAuth();

      const [c, h, s] = await Promise.all([api.listCheckins(200), api.listHabits(false), api.summary(days)]);
      setCheckins(c.checkins || []);
      setHabits(h.habits || []);
      setSummary(s.summary || null);

      // Staff-only org summary
      try {
        const os = await api.orgSummary(days);
        setOrgSummary(os.summary || null);
      } catch {
        setOrgSummary(null);
      }
    } catch (e: any) {
      setToast({ type: "bad", text: e?.message || "Failed to load dashboard." });
      setTimeout(() => nav("/login"), 250);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parsedTags = useMemo(() => {
    return tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
  }, [tags]);

  async function createCheckin() {
    setToast(null);
    setSavingCheckin(true);
    try {
      await api.createCheckin({
        mood: clamp(Number(mood), 1, 10),
        energy: clamp(Number(energy), 1, 10),
        stress: clamp(Number(stress), 1, 10),
        note: note.trim() ? note.trim() : undefined,
        tags: parsedTags.length ? parsedTags : undefined,
      });

      setToast({ type: "good", text: "Check-in saved." });
      setNote("");
      setTags("");

      const [c, s] = await Promise.all([api.listCheckins(200), api.summary(days)]);
      setCheckins(c.checkins || []);
      setSummary(s.summary || null);

      if (isStaff) {
        try {
          const os = await api.orgSummary(days);
          setOrgSummary(os.summary || null);
        } catch {
          // ignore
        }
      }
    } catch (e: any) {
      setToast({ type: "bad", text: e?.message || "Failed to save check-in." });
    } finally {
      setSavingCheckin(false);
    }
  }

  async function deleteCheckin(id: string) {
    setToast(null);
    try {
      await api.deleteCheckin(id);
      setCheckins((prev) => prev.filter((c) => c.id !== id));
      setToast({ type: "good", text: "Deleted." });

      const s = await api.summary(days);
      setSummary(s.summary || null);

      if (isStaff) {
        try {
          const os = await api.orgSummary(days);
          setOrgSummary(os.summary || null);
        } catch {
          // ignore
        }
      }
    } catch (e: any) {
      setToast({ type: "bad", text: e?.message || "Delete failed." });
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Dashboard</h1>
            <div className="sub">
              Track check-ins, habits, and patterns. {isStaff ? "Staff access enabled." : "User access."}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link className="btn" to="/outlet/inbox">
              Inbox
            </Link>
            <Link className="btn" to="/outlet">
              Counselor’s Office
            </Link>
            <button className="btn" onClick={bootstrap} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        <div className="body">
          {toast ? <div className={`toast ${toast.type}`}>{toast.text}</div> : null}
          {loading ? <div className="small">Loading…</div> : null}

          {!loading ? (
            <div className="grid2">
              <div className="panel">
                <div className="panelTitle">
                  <span>Quick check-in</span>
                  <span className="badge">{todayKey()}</span>
                </div>

                <div className="row" style={{ marginTop: 12 }}>
                  <div className="col">
                    <div className="label">Mood (1–10)</div>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={10}
                      value={mood}
                      onChange={(e) => setMood(Number(e.target.value))}
                    />
                  </div>
                  <div className="col">
                    <div className="label">Energy (1–10)</div>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={10}
                      value={energy}
                      onChange={(e) => setEnergy(Number(e.target.value))}
                    />
                  </div>
                  <div className="col">
                    <div className="label">Stress (1–10)</div>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={10}
                      value={stress}
                      onChange={(e) => setStress(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div className="label">Note (optional)</div>
                  <textarea
                    className="textarea"
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="What influenced today?"
                  />
                </div>

                <div style={{ marginTop: 10 }}>
                  <div className="label">Tags (optional, comma-separated)</div>
                  <input
                    className="input"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="sleep, workload, conflict, pay…"
                  />
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                  <button className="btn primary" onClick={createCheckin} disabled={savingCheckin}>
                    {savingCheckin ? "Saving…" : "Save check-in"}
                  </button>
                </div>

                {/* ✅ TRUST LOOP (A+): Context-aware visibility */}
                <div className="list" style={{ marginTop: 14 }}>
                  <div className="listItemStatic">
                    <div className="listTitle">Trust loop: what’s visible (check-ins)</div>

                    {!isStaff ? (
                      <div className="small" style={{ marginTop: 6, lineHeight: 1.45 }}>
                        • Your check-ins help you track <b>you</b> first.
                        <br />
                        • Your organization receives <b>responsible visibility into patterns</b> that affect wellbeing,
                        retention, and safety — without violating individual dignity.
                        <br />
                        • Staff visibility is <b>role-based</b> and should focus on trends, not personal judgment.
                        <br />
                        • For private narrative + optional escalation, use{" "}
                        <Link to="/outlet" style={{ textDecoration: "underline" }}>
                          Counselor’s Office
                        </Link>
                        .
                      </div>
                    ) : (
                      <div className="small" style={{ marginTop: 6, lineHeight: 1.45 }}>
                        • You’re viewing this as <b>staff</b>. Use this to support people — not police them.
                        <br />
                        • Default stance: prioritize <b>aggregates + trends</b> (org patterns) over individual scrutiny.
                        <br />
                        • Treat “early risk signals” as a <b>prompt to offer support</b>, not as proof.
                        <br />
                        • If you need narrative context, rely on{" "}
                        <Link to="/outlet/inbox" style={{ textDecoration: "underline" }}>
                          Inbox
                        </Link>{" "}
                        escalation paths, not routine check-ins.
                      </div>
                    )}
                  </div>
                </div>

                <div className="small" style={{ marginTop: 10 }}>
                  Counselor’s Office is separate: use it for narrative + escalation.
                </div>
              </div>

              <div className="panel">
                <div className="panelTitle">
                  <span>Summary</span>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="small">Days</span>
                    <select
                      className="select"
                      value={days}
                      onChange={async (e) => {
                        const v = Number(e.target.value);
                        setDays(v);
                        setToast(null);
                        try {
                          const s = await api.summary(v);
                          setSummary(s.summary || null);
                          if (isStaff) {
                            const os = await api.orgSummary(v);
                            setOrgSummary(os.summary || null);
                          }
                        } catch (err: any) {
                          setToast({ type: "bad", text: err?.message || "Failed to update summary." });
                        }
                      }}
                    >
                      <option value={7}>7</option>
                      <option value={14}>14</option>
                      <option value={30}>30</option>
                      <option value={60}>60</option>
                      <option value={90}>90</option>
                    </select>
                  </div>
                </div>

                {!summary ? (
                  <div className="small" style={{ marginTop: 12 }}>
                    No summary yet.
                  </div>
                ) : (
                  <div className="list" style={{ marginTop: 12 }}>
                    <div className="listItemStatic">
                      <div className="listTop">
                        <div>
                          <div className="listTitle">Streak</div>
                          <div className="small">Days in a row: {summary.streak}</div>
                        </div>
                        <span className="badge">{summary.today}</span>
                      </div>
                    </div>

                    <div className="listItemStatic">
                      <div className="listTitle">Overall averages</div>
                      <div className="row" style={{ marginTop: 10 }}>
                        <div className="col">
                          <div className="small">Mood</div>
                          <div className="small">{summary.overall.moodAvg ?? "—"}</div>
                        </div>
                        <div className="col">
                          <div className="small">Energy</div>
                          <div className="small">{summary.overall.energyAvg ?? "—"}</div>
                        </div>
                        <div className="col">
                          <div className="small">Stress</div>
                          <div className="small">{summary.overall.stressAvg ?? "—"}</div>
                        </div>
                        <div className="col">
                          <div className="small">Total</div>
                          <div className="small">{summary.overall.total}</div>
                        </div>
                      </div>
                    </div>

                    {isStaff && orgSummary ? (
                      <div className="listItemStatic">
                        <div className="listTitle">Org summary (staff)</div>
                        <div className="small" style={{ marginTop: 6 }}>
                          Aggregated org-level patterns over the selected time window.
                        </div>
                        <div className="row" style={{ marginTop: 10 }}>
                          <div className="col">
                            <div className="small">Mood avg</div>
                            <div className="small">{orgSummary.overall.moodAvg ?? "—"}</div>
                          </div>
                          <div className="col">
                            <div className="small">Energy avg</div>
                            <div className="small">{orgSummary.overall.energyAvg ?? "—"}</div>
                          </div>
                          <div className="col">
                            <div className="small">Stress avg</div>
                            <div className="small">{orgSummary.overall.stressAvg ?? "—"}</div>
                          </div>
                          <div className="col">
                            <div className="small">Check-ins</div>
                            <div className="small">{orgSummary.overall.checkins}</div>
                          </div>
                          <div className="col">
                            <div className="small">Users</div>
                            <div className="small">{orgSummary.overall.users}</div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panelTitle">
                  <span>Recent check-ins</span>
                  <span className="badge">{checkins.length}</span>
                </div>

                {!checkins.length ? (
                  <div className="small" style={{ marginTop: 12 }}>
                    No check-ins yet.
                  </div>
                ) : (
                  <div className="list" style={{ marginTop: 12 }}>
                    {checkins.slice(0, 20).map((c) => (
                      <div key={c.id} className="listItemStatic">
                        <div className="listTop">
                          <div>
                            <div className="listTitle">
                              {c.dayKey} • Mood {c.mood} • Energy {c.energy} • Stress {c.stress}
                            </div>
                            <div className="small">
                              {c.note ? c.note : "—"} {c.tagsJson && c.tagsJson !== "[]" ? `• tags ${c.tagsJson}` : ""}
                            </div>
                          </div>
                          <button className="btn danger" onClick={() => deleteCheckin(c.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panelTitle">
                  <span>Habits</span>
                  <span className="badge">{habits.length}</span>
                </div>

                {!habits.length ? (
                  <div className="small" style={{ marginTop: 12 }}>
                    No habits yet. Add a few to track consistency.
                  </div>
                ) : (
                  <div className="list" style={{ marginTop: 12 }}>
                    {habits.slice(0, 20).map((h) => (
                      <div key={h.id} className="listItemStatic">
                        <div className="listTop">
                          <div>
                            <div className="listTitle">{h.name}</div>
                            <div className="small">Target per week: {h.targetPerWeek}</div>
                          </div>
                          <button
                            className="btn"
                            onClick={async () => {
                              setToast(null);
                              try {
                                await api.archiveHabit(h.id);
                                const r = await api.listHabits(false);
                                setHabits(r.habits || []);
                              } catch (e: any) {
                                setToast({ type: "bad", text: e?.message || "Archive failed." });
                              }
                            }}
                          >
                            Archive
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="small" style={{ marginTop: 10 }}>
                  Tip: Keep habits lightweight. The goal is consistency, not perfection.
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
