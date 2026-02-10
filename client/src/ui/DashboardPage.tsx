// client/src/ui/DashboardPage.tsx (FULL REPLACEMENT)

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AuthPayload } from "../lib/api";
import { api, apiGet, setToken } from "../lib/api";

function TrustLoopCallout() {
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="panelTitle">
        <span>Trust loop</span>
        <span className="badge good">A1</span>
      </div>

      <div className="small" style={{ marginTop: 8, lineHeight: 1.7 }}>
        <b>Private first</b> → <b>reflection without looping</b> → <b>choice to escalate</b> →{" "}
        <b>responsible staff action</b> → <b>resolution + retention + safety</b>, while preserving dignity.
        <br />
        <br />
        Read the doctrine: <Link to="/visibility">Responsible Visibility</Link>. • Go to:{" "}
        <Link to="/outlet">Counselor’s Office</Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const nav = useNavigate();

  const [auth, setAuth] = useState<AuthPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [mood, setMood] = useState(7);
  const [energy, setEnergy] = useState(7);
  const [stress, setStress] = useState(4);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");

  const [checkins, setCheckins] = useState<any[]>([]);
  const [habits, setHabits] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);

  async function loadAuth() {
    const me = await apiGet<{ auth: AuthPayload }>("/api/me");
    setAuth(me.auth);
  }

  async function loadAll() {
    setErr(null);
    try {
      const [c, h, s] = await Promise.all([api.listCheckins(200), api.listHabits(false), api.summary(30)]);
      setCheckins(c.checkins || []);
      setHabits(h.habits || []);
      setSummary(s.summary || null);
    } catch (e: any) {
      setErr(e?.message || "Failed to load data");
    }
  }

  async function createCheckin() {
    setErr(null);
    try {
      const tagArr = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20);

      const r = await api.createCheckin({
        mood,
        energy,
        stress,
        note: note.trim() ? note.trim() : undefined,
        tags: tagArr.length ? tagArr : undefined,
      });

      setNote("");
      setTags("");
      setCheckins((prev) => [r.checkin, ...prev]);

      const s = await api.summary(30);
      setSummary(s.summary || null);
    } catch (e: any) {
      setErr(e?.message || "Failed to create check-in");
    }
  }

  function logout() {
    setToken(null);
    nav("/login");
  }

  useEffect(() => {
    (async () => {
      try {
        await loadAuth();
        await loadAll();
      } catch {
        nav("/login");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const streakLabel = useMemo(() => {
    const n = Number(summary?.streak || 0);
    if (!n) return "No streak yet";
    if (n === 1) return "1 day streak";
    return `${n} day streak`;
  }, [summary?.streak]);

  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Dashboard</h1>
            <div className="sub">Consistency, accountability, and growth — with dignity.</div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link className="btn" to="/outlet">
              Counselor’s Office
            </Link>
            <Link className="btn" to="/outlet-inbox">
              Inbox
            </Link>
            <Link className="btn" to="/visibility">
              Visibility
            </Link>
            <button className="btn danger" onClick={logout}>
              Log out
            </button>
          </div>
        </div>

        <div className="body">
          {err ? <div className="toast bad">{err}</div> : null}

          <TrustLoopCallout />

          <div className="grid2">
            <div className="panel">
              <div className="panelTitle">
                <span>New check-in</span>
                <span className="badge">{streakLabel}</span>
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
                  placeholder="Anything you want to capture…"
                />
              </div>

              <div style={{ marginTop: 10 }}>
                <div className="label">Tags (optional, comma-separated)</div>
                <input
                  className="input"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="sleep, overtime, conflict, focus…"
                />
              </div>

              <div style={{ marginTop: 10 }}>
                <button className="btn primary" onClick={createCheckin}>
                  Save check-in
                </button>
              </div>

              {summary ? (
                <div className="small" style={{ marginTop: 12, lineHeight: 1.7 }}>
                  <b>30-day averages:</b> mood {summary.overall?.moodAvg?.toFixed?.(1) ?? "—"} • energy{" "}
                  {summary.overall?.energyAvg?.toFixed?.(1) ?? "—"} • stress{" "}
                  {summary.overall?.stressAvg?.toFixed?.(1) ?? "—"} • total {summary.overall?.total ?? 0}
                </div>
              ) : null}
            </div>

            <div className="panel">
              <div className="panelTitle">
                <span>Recent check-ins</span>
                <button className="btn" onClick={loadAll}>
                  Refresh
                </button>
              </div>

              {!checkins.length ? (
                <div className="small" style={{ marginTop: 12 }}>
                  No check-ins yet.
                </div>
              ) : (
                <div className="list" style={{ marginTop: 12 }}>
                  {checkins.slice(0, 12).map((c) => (
                    <div key={c.id} className="listItemStatic">
                      <div className="listTop">
                        <div>
                          <div className="listTitle">{c.dayKey}</div>
                          <div className="small">
                            mood {c.mood} • energy {c.energy} • stress {c.stress}
                          </div>
                        </div>
                        <span className="badge">{new Date(c.ts).toLocaleString()}</span>
                      </div>
                      {c.note ? (
                        <div className="small" style={{ marginTop: 6 }}>
                          {c.note}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel" style={{ marginTop: 12 }}>
            <div className="panelTitle">
              <span>Habits</span>
              <span className="badge">{habits.length} active</span>
            </div>

            {!habits.length ? (
              <div className="small" style={{ marginTop: 10 }}>
                No habits yet.
              </div>
            ) : (
              <div className="list" style={{ marginTop: 10 }}>
                {habits.slice(0, 12).map((h) => (
                  <div key={h.id} className="listItemStatic">
                    <div className="listTop">
                      <div>
                        <div className="listTitle">{h.name}</div>
                        <div className="small">Target: {h.targetPerWeek}/week</div>
                      </div>
                      <span className="badge">{new Date(h.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="small" style={{ marginTop: 12 }}>
            Need to understand what the org can see? <Link to="/visibility">Read the visibility doctrine</Link>.
          </div>

          <div className="small" style={{ marginTop: 10 }}>
            Logged in as <b>{auth?.userId ? auth.userId : "—"}</b>
          </div>
        </div>
      </div>
    </div>
  );
}
