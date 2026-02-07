// client/src/ui/OutletInboxPage.tsx (FULL REPLACEMENT)

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AuthPayload, Role } from "../lib/api";
import { apiGet } from "../lib/api";

type OutletVisibility = "private" | "manager" | "admin";
type OutletStatus = "open" | "escalated" | "closed" | "resolved";

function riskBadge(riskLevel: number) {
  if (riskLevel >= 2) return { cls: "badge bad", label: "High risk" };
  if (riskLevel === 1) return { cls: "badge warn", label: "Elevated" };
  return { cls: "badge good", label: "Normal" };
}

function visLabel(v: OutletVisibility) {
  if (v === "admin") return "Admin";
  if (v === "manager") return "Manager";
  return "Private";
}

function statusLabel(s: OutletStatus) {
  if (s === "resolved") return "Resolved";
  if (s === "closed") return "Closed";
  if (s === "escalated") return "Escalated";
  return "Open";
}

function isoToMs(v: any) {
  const t = Date.parse(String(v || ""));
  return Number.isFinite(t) ? t : 0;
}

export function OutletInboxPage() {
  const nav = useNavigate();

  const [auth, setAuth] = useState<AuthPayload | null>(null);
  const role = auth?.role as Role | undefined;
  const isStaff = role === "admin" || role === "manager";

  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [onlyEscalated, setOnlyEscalated] = useState(true);
  const [minRisk, setMinRisk] = useState<0 | 1 | 2>(0);

  async function loadAuth() {
    const me = await apiGet<{ auth: AuthPayload }>("/api/me");
    setAuth(me.auth);
  }

  async function loadInbox() {
    setMsg(null);
    setLoading(true);
    try {
      // Uses backend: GET /api/outlet/sessions?view=staff
      const r = await apiGet<{ sessions: any[] }>("/api/outlet/sessions?view=staff&limit=200");
      setSessions(r.sessions || []);
    } catch (e: any) {
      setMsg(e.message || "Failed to load inbox.");
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
    if (!(auth.role === "admin" || auth.role === "manager")) {
      nav("/outlet");
      return;
    }
    loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  const triage = useMemo(() => {
    let list = [...sessions];

    if (onlyEscalated) {
      list = list.filter((s) => String(s.status || "open") === "escalated");
    }

    if (minRisk > 0) {
      list = list.filter((s) => Number(s.riskLevel || 0) >= minRisk);
    }

    // Sort: lastMessageAt desc, risk desc, updated desc
    list.sort((a, b) => {
      const aLast = isoToMs(a.lastMessageAt || a.updatedAt || a.createdAt);
      const bLast = isoToMs(b.lastMessageAt || b.updatedAt || b.createdAt);
      if (bLast !== aLast) return bLast - aLast;

      const aRisk = Number(a.riskLevel || 0);
      const bRisk = Number(b.riskLevel || 0);
      if (bRisk !== aRisk) return bRisk - aRisk;

      const aUpd = isoToMs(a.updatedAt || a.createdAt);
      const bUpd = isoToMs(b.updatedAt || b.createdAt);
      return bUpd - aUpd;
    });

    return list;
  }, [sessions, onlyEscalated, minRisk]);

  if (auth && !isStaff) {
    return null;
  }

  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Staff Inbox</h1>
            <div className="sub">Triage escalations • sort by recency and risk</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn" to="/outlet">
              Counselor’s Office
            </Link>
            <Link className="btn" to="/dashboard">
              Dashboard
            </Link>
            <button className="btn" onClick={loadInbox} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        <div className="body">
          {msg ? <div className="toast bad">{msg}</div> : null}

          <div className="panel">
            <div className="panelTitle">
              <span>Filters</span>
              <span className="badge">
                {triage.length} item{triage.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="row" style={{ marginTop: 12, alignItems: "flex-end" }}>
              <div className="col" style={{ flexBasis: 220 }}>
                <div className="label">Show</div>
                <select
                  className="select"
                  value={onlyEscalated ? "escalated" : "all"}
                  onChange={(e) => setOnlyEscalated(e.target.value === "escalated")}
                >
                  <option value="escalated">Escalated only</option>
                  <option value="all">All visible</option>
                </select>
              </div>

              <div className="col" style={{ flexBasis: 220 }}>
                <div className="label">Min risk</div>
                <select
                  className="select"
                  value={String(minRisk)}
                  onChange={(e) => setMinRisk(Number(e.target.value) as any)}
                >
                  <option value="0">Any</option>
                  <option value="1">Elevated+</option>
                  <option value="2">High risk only</option>
                </select>
              </div>

              <div className="col">
                <div className="small">
                  Sorted by <b>last message</b>, then <b>risk</b>.
                </div>
              </div>
            </div>
          </div>

          {loading ? <div className="small" style={{ marginTop: 12 }}>Loading…</div> : null}

          {!loading && triage.length === 0 ? (
            <div className="small" style={{ marginTop: 12 }}>Nothing in the inbox right now.</div>
          ) : null}

          <div className="list" style={{ marginTop: 12 }}>
            {triage.map((s) => {
              const rb = riskBadge(Number(s.riskLevel || 0));
              const last = s.lastMessageAt || s.updatedAt || s.createdAt;
              const st: OutletStatus = (s.status as OutletStatus) || "open";

              return (
                <div
                  key={s.id}
                  className="listItem"
                  onClick={() => nav(`/outlet/${s.id}`)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="listTop">
                    <div>
                      <div className="listTitle">{s.category ? s.category : "General"}</div>
                      <div className="small">
                        {statusLabel(st)} • {visLabel(s.visibility)} • Last:{" "}
                        {last ? new Date(last).toLocaleString() : "—"}
                      </div>
                    </div>

                    <div className="chips">
                      <span className={rb.cls}>{rb.label}</span>
                      {String(s.status) === "escalated" ? <span className="badge warn">Escalated</span> : null}
                      {String(s.status) === "resolved" ? <span className="badge good">Resolved</span> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="small" style={{ marginTop: 10 }}>
            Note: staff can view sessions only when visibility permits (manager/admin rules).
          </div>
        </div>
      </div>
    </div>
  );
}
