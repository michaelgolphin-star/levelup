// client/src/ui/OutletInboxPage.tsx (FULL REPLACEMENT)

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AuthPayload, Role, OutletSession } from "../lib/api";
import { api, apiGet } from "../lib/api";

type ViewMode = "mine" | "staff";

function formatTs(iso: any) {
  if (!iso) return "";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function statusLabel(s: any) {
  const v = String(s || "open").toLowerCase();
  if (v === "resolved") return "Resolved";
  if (v === "closed") return "Closed";
  if (v === "escalated") return "Escalated";
  return "Open";
}

function visLabel(v: any) {
  const s = String(v || "private").toLowerCase();
  if (s === "admin") return "Admin";
  if (s === "manager") return "Manager";
  return "Private";
}

function riskBadge(riskLevel: number) {
  const n = Number(riskLevel || 0);
  if (n >= 2) return { cls: "badge bad", label: "High risk" };
  if (n === 1) return { cls: "badge warn", label: "Elevated" };
  return { cls: "badge good", label: "Normal" };
}

export default function OutletInboxPage() {
  const nav = useNavigate();

  const [auth, setAuth] = useState<AuthPayload | null>(null);
  const role = auth?.role as Role | undefined;
  const isStaff = role === "admin" || role === "manager";

  const [view, setView] = useState<ViewMode>("mine");
  const [sessions, setSessions] = useState<OutletSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const title = useMemo(() => {
    return view === "staff" ? "Inbox (Staff)" : "Inbox (Mine)";
  }, [view]);

  async function loadAuth() {
    const me = await apiGet<{ auth: AuthPayload }>("/api/me");
    setAuth(me.auth);
  }

  async function loadSessions(nextView: ViewMode = view) {
    setMsg(null);
    setLoading(true);
    try {
      if (nextView === "staff") {
        if (!isStaff) {
          setSessions([]);
          setMsg("Staff inbox is only available to managers/admins.");
          return;
        }
        const r = await api.outletListStaffSessions(200);
        setSessions((r.sessions || []) as any);
      } else {
        const r = await api.outletListMySessions(100);
        setSessions((r.sessions || []) as any);
      }
    } catch (e: any) {
      setMsg(e?.message || "Failed to load inbox.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await loadAuth();
      } catch {
        nav("/login");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auth) return;
    loadSessions("mine");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>{title}</h1>
            <div className="sub">Quick access to Counselor’s Office sessions.</div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link className="btn" to="/dashboard">
              Dashboard
            </Link>
            <Link className="btn primary" to="/outlet">
              Go to Counselor’s Office
            </Link>
          </div>
        </div>

        <div className="body">
          <div className="panel">
            <div className="panelTitle">
              <span>Sessions</span>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  className={`btn ${view === "mine" ? "primary" : ""}`}
                  onClick={() => {
                    setView("mine");
                    loadSessions("mine");
                  }}
                >
                  Mine
                </button>

                <button
                  className={`btn ${view === "staff" ? "primary" : ""}`}
                  onClick={() => {
                    setView("staff");
                    loadSessions("staff");
                  }}
                  disabled={!isStaff}
                  title={!isStaff ? "Staff inbox requires manager/admin" : ""}
                >
                  Staff
                </button>

                <button className="btn" onClick={() => loadSessions(view)}>
                  Refresh
                </button>
              </div>
            </div>

            {msg ? <div className="toast bad">{msg}</div> : null}
            {loading ? <div className="small" style={{ marginTop: 12 }}>Loading…</div> : null}

            {!loading && sessions.length === 0 ? (
              <div className="small" style={{ marginTop: 12 }}>
                No sessions found.
              </div>
            ) : null}

            <div className="list" style={{ marginTop: 10 }}>
              {sessions.map((s: any) => {
                const rb = riskBadge(Number(s.riskLevel || 0));
                const st = statusLabel(s.status);
                const vis = visLabel(s.visibility);
                const last = formatTs(s.lastMessageAt || s.updatedAt || s.createdAt);

                return (
                  <div
                    key={s.id}
                    className="listItem"
                    onClick={() => nav(`/outlet/${s.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") nav(`/outlet/${s.id}`);
                    }}
                  >
                    <div className="listTop">
                      <div>
                        <div className="listTitle">{s.category ? s.category : "General"}</div>
                        <div className="small">
                          {st} • {vis} • Created {formatTs(s.createdAt)}
                          {last ? (
                            <>
                              {" "}
                              • Last activity {last}
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="chips">
                        <span className={rb.cls}>{rb.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="small" style={{ marginTop: 10 }}>
              Tip: Inbox is for navigation. Session creation happens in Counselor’s Office.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
