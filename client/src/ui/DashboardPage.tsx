// client/src/ui/DashboardPage.tsx (FULL REPLACEMENT)

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AuthPayload, CheckIn, Habit, Role, Summary } from "../lib/api";
import { api, apiGet } from "../lib/api";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const nav = useNavigate();

  const [auth, setAuth] = useState<AuthPayload | null>(null);
  const role = auth?.role as Role | undefined;
  const isStaff = role === "admin" || role === "manager";

  const [toast, setToast] = useState<{ type: "good" | "bad"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Summary
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<Summary | null>(null);

  // Check-in form
  const [mood, setMood] = useState(7);
  const [energy, setEnergy] = useState(7);
  const [stress, setStress] = useState(4);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [savingCheckin, setSavingCheckin] = useState(false);

  // Check-ins list
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [loadingCheckins, setLoadingCheckins] = useState(false);

  // Habits
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loadingHabits, setLoadingHabits] = useState(false);
  const [habitName, setHabitName] = useState("");
  const [habitTarget, setHabitTarget] = useState(3);
  const [savingHabit, setSavingHabit] = useState(false);

  const parsedTags = useMemo(() => {
    return tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);
  }, [tags]);

  async function loadAuth() {
    const me = await apiGet<{ auth: AuthPayload }>("/api/me");
    setAuth(me.auth);
  }

  async function loadSummary(nextDays = days) {
    const r = await api.summary(nextDays);
    setSummary(r.summary);
  }

  async function loadCheckins() {
    setLoadingCheckins(true);
    try {
      const r = await api.listCheckins(200);
      setCheckins(r.checkins || []);
    } finally {
      setLoadingCheckins(false);
    }
  }

  async function loadHabits() {
    setLoadingHabits(true);
    try {
      const r = await api.listHabits(false);
      setHabits(r.habits || []);
    } finally {
      setLoadingHabits(false);
    }
  }

  async function bootstrap() {
    setToast(null);
    setLoading(true);
    try {
      await loadAuth();
      await Promise.all([loadSummary(days), loadCheckins(), loadHabits()]);
    } catch (e: any) {
      setToast({ type: "bad", text: e?.message || "Please log in again." });
      nav("/login");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createCheckin() {
    setToast(null);
    setSavingCheckin(true);
    try {
      await api.createCheckin({
        mood,
        energy,
        stress,
        note: note.trim() ? note.trim() : undefined,
        tags: parsedTags.length ? parsedTags : undefined,
      });
      setToast({ type: "good", text: "Check-in saved." });
      setNote("");
      setTags("");
      await Promise.all([loadSummary(days), loadCheckins()]);
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
      setToast({ type: "good", text: "Check-in deleted." });
      await Promise.all([loadSummary(days), loadCheckins()]);
    } catch (e: any) {
      setToast({ type: "bad", text: e?.message || "Delete failed." });
    }
  }

  async function createHabit() {
    const name = habitName.trim();
    if (!name) {
      setToast({ type: "bad", text: "Habit name is required." });
      return;
    }
    setToast(null);
    setSavingHabit(true);
    try {
      await api.createHabit({ name, targetPerWeek: habitTarget });
      setToast({ type: "good", text: "Habit added." });
      setHabitName("");
      setHabitTarget(3);
      await loadHabits();
    } catch (e: any) {
      setToast({ type: "bad", text: e?.message || "Failed to add habit." });
    } finally {
      setSavingHabit(false);
    }
  }

  async function archiveHabit(id: string) {
    setToast(null);
    try {
      await api.archiveHabit(id);
      setToast({ type: "good", text: "Habit archived." });
      await loadHabits();
    } catch (e: any) {
      setToast({ type: "bad", text: e?.message || "Archive failed." });
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
                        try {
                          await loadSummary(v);
                        } catch {}
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
                  <div style={{ marginTop: 12 }}>
                    <div className="list">
                      <div className="listItemStatic">
                        <div className="listTitle">Streak</div>
                        <div className="small">{summary.streak} days</div>
                      </div>
                      <div className="listItemStatic">
                        <div className="listTitle">Mood avg</div>
                        <div className="small">{summary.overall.moodAvg ?? "—"}</div>
                      </div>
                      <div className="listItemStatic">
                        <div className="listTitle">Energy avg</div>
                        <div className="small">{summary.overall.energyAvg ?? "—"}</div>
                      </div>
                      <div className="listItemStatic">
                        <div className="listTitle">Stress avg</div>
                        <div className="small">{summary.overall.stressAvg ?? "—"}</div>
                      </div>
                      <div className="listItemStatic">
                        <div className="listTitle">Total check-ins</div>
                        <div className="small">{summary.overall.total}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panelTitle">
                  <span>Habits</span>
                  <button className="btn" onClick={loadHabits} disabled={loadingHabits}>
                    Refresh
                  </button>
                </div>

                <div className="row" style={{ marginTop: 12 }}>
                  <div className="col">
                    <div className="label">Habit name</div>
                    <input
                      className="input"
                      value={habitName}
                      onChange={(e) => setHabitName(e.target.value)}
                      placeholder="Walk, meditate, stretch…"
                    />
                  </div>
                  <div className="col" style={{ flexBasis: 220 }}>
                    <div className="label">Target / week</div>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={14}
                      value={habitTarget}
                      onChange={(e) => setHabitTarget(Number(e.target.value))}
                    />
                  </div>
                  <div className="col" style={{ flexBasis: 160, alignSelf: "flex-end" }}>
                    <button className="btn primary" onClick={createHabit} disabled={savingHabit}>
                      {savingHabit ? "Adding…" : "Add"}
                    </button>
                  </div>
                </div>

                <div className="list" style={{ marginTop: 12 }}>
                  {habits.map((h: any) => (
                    <div key={h.id} className="listItemStatic">
                      <div className="listTop">
                        <div>
                          <div className="listTitle">{h.name}</div>
                          <div className="small">Target: {h.targetPerWeek}/week</div>
                        </div>
                        <div className="chips">
                          <button className="btn" onClick={() => archiveHabit(h.id)}>
                            Archive
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!loadingHabits && habits.length === 0 ? <div className="small">No habits yet.</div> : null}
                </div>
              </div>

              <div className="panel">
                <div className="panelTitle">
                  <span>Recent check-ins</span>
                  <button className="btn" onClick={loadCheckins} disabled={loadingCheckins}>
                    Refresh
                  </button>
                </div>

                <div className="list" style={{ marginTop: 12 }}>
                  {checkins.map((c: any) => (
                    <div key={c.id} className="listItemStatic">
                      <div className="listTop">
                        <div>
                          <div className="listTitle">
                            {c.dayKey} • Mood {c.mood} • Energy {c.energy} • Stress {c.stress}
                          </div>
                          <div className="small">{c.note ? c.note : "—"}</div>
                        </div>
                        <div className="chips">
                          <button className="btn danger" onClick={() => deleteCheckin(c.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!loadingCheckins && checkins.length === 0 ? <div className="small">No check-ins yet.</div> : null}
                </div>

                <div className="small" style={{ marginTop: 10 }}>
                  You can still keep things dignified: the point is patterns, not “spying.”
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
