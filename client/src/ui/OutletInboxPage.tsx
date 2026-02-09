// client/src/ui/OutletInboxPage.tsx (FULL REPLACEMENT)

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiGet } from "../lib/api";

type Role = "user" | "manager" | "admin";

type InboxItem = {
  id: string;
  orgId: string;
  userId: string;

  kind: "outlet";
  title: string;
  preview: string;

  createdAt: string;
  isRead: boolean;
  ackState: "none" | "acknowledged" | "dismissed";

  // outlet linkage
  outletSessionId?: string;
  riskLevel?: number;
  visibility?: "private" | "manager" | "admin";
  status?: "open" | "escalated" | "closed" | "resolved";
};

function fmt(iso: any) {
  if (!iso) return "";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function badgeForRisk(r: number) {
  const n = Number(r || 0);
  if (n >= 2) return { cls: "badge bad", label: "High risk" };
  if (n === 1) return { cls: "badge warn", label: "Elevated" };
  return { cls: "badge good", label: "Normal" };
}

export default function OutletInboxPage() {
  const nav = useNavigate();

  const [role, setRole] = useState<Role>("user");
  const isStaff = role === "admin" || role === "manager";

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [items, setItems] = useState<InboxItem[]>([]);
  const [staffItems, setStaffItems] = useState<InboxItem[]>([]);

  async function load() {
    setMsg(null);
    setLoading(true);

    try {
      // auth snapshot
      const me = await apiGet<{ auth: { role: Role } }>("/api/me");
      setRole(me.auth.role);

      // my inbox
      const mine = await apiGet<{ items: InboxItem[] }>("/api/inbox?limit=50");
      setItems(mine.items || []);

      // staff inbox (if allowed)
      if (me.auth.role === "admin" || me.auth.role === "manager") {
        const staff = await apiGet<{ messages: InboxItem[] }>("/api/staff/inbox?limit=50");
        setStaffItems(staff.messages || []);
      } else {
        setStaffItems([]);
      }
    } catch (e: any) {
      // If token missing/invalid, this will happen.
      setMsg(e?.message || "Failed to load inbox.");
      nav("/login");
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    try {
      await apiGet<{ ok: boolean }>(`/api/inbox/${encodeURIComponent(id)}/read`);
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, isRead: true } : x)));
      setStaffItems((prev) => prev.map((x) => (x.id === id ? { ...x, isRead: true } : x)));
    } catch (e: any) {
      setMsg(e?.message || "Failed to mark read.");
    }
  }

  async function ack(id: string, action: "acknowledged" | "dismissed") {
    try {
      await apiGet<{ ok: boolean }>(`/api/inbox/${encodeURIComponent(id)}/ack?action=${encodeURIComponent(action)}`);
      setItems((prev) => prev.map((x) => (x.id === id ? { ...x, ackState: action } : x)));
      setStaffItems((prev) => prev.map((x) => (x.id === id ? { ...x, ackState: action } : x)));
    } catch (e: any) {
      setMsg(e?.message || "Failed to acknowledge.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = useMemo(() => items.filter((x) => !x.isRead).length, [items]);

  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Inbox</h1>
            <div className="sub">
              Your notifications • {unreadCount} unread • Role: {role}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn" to="/dashboard">
              Dashboard
            </Link>
            <Link className="btn" to="/outlet">
              Counselor’s Office
            </Link>
            <button className="btn" onClick={load} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        <div className="body">
          {msg ? <div className="toast bad">{msg}</div> : null}
          {loading ? <div className="small">Loading…</div> : null}

          {!loading && items.length === 0 ? <div className="small">No inbox items yet.</div> : null}

          {!loading && items.length > 0 ? (
            <>
              <div className="panelTitle" style={{ marginTop: 4 }}>
                <span>My Inbox</span>
                <span className="badge">{items.length}</span>
              </div>

              <div className="list" style={{ marginTop: 12 }}>
                {items.map((it) => {
                  const rb = badgeForRisk(Number(it.riskLevel || 0));
                  const goTo = it.outletSessionId ? `/outlet/${it.outletSessionId}` : "/outlet";

                  return (
                    <div key={it.id} className="listItem">
                      <div className="listTop">
                        <div>
                          <div className="listTitle">
                            {it.title || "Update"} {!it.isRead ? <span className="badge warn">Unread</span> : null}
                          </div>
                          <div className="small">
                            {it.preview || ""} • {fmt(it.createdAt)}
                          </div>
                        </div>

                        <div className="chips">
                          <span className={rb.cls}>{rb.label}</span>
                          {it.status ? <span className="badge">{it.status}</span> : null}
                          {it.visibility ? <span className="badge">{it.visibility}</span> : null}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                        <button className="btn primary" onClick={() => nav(goTo)}>
                          Open
                        </button>
                        <button className="btn" onClick={() => markRead(it.id)} disabled={it.isRead}>
                          Mark read
                        </button>
                        <button className="btn" onClick={() => ack(it.id, "acknowledged")} disabled={it.ackState !== "none"}>
                          Acknowledge
                        </button>
                        <button className="btn danger" onClick={() => ack(it.id, "dismissed")} disabled={it.ackState !== "none"}>
                          Dismiss
                        </button>
                      </div>

                      {it.ackState !== "none" ? (
                        <div className="small" style={{ marginTop: 8 }}>
                          Ack: {it.ackState}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}

          {isStaff ? (
            <>
              <div className="panelTitle" style={{ marginTop: 18 }}>
                <span>Staff Inbox</span>
                <span className="badge">{staffItems.length}</span>
              </div>

              {!loading && staffItems.length === 0 ? (
                <div className="small" style={{ marginTop: 12 }}>
                  No staff items.
                </div>
              ) : null}

              <div className="list" style={{ marginTop: 12 }}>
                {staffItems.map((it) => {
                  const rb = badgeForRisk(Number(it.riskLevel || 0));
                  const goTo = it.outletSessionId ? `/outlet/${it.outletSessionId}` : "/outlet";
                  return (
                    <div key={it.id} className="listItem" onClick={() => nav(goTo)} role="button" tabIndex={0}>
                      <div className="listTop">
                        <div>
                          <div className="listTitle">{it.title || "Staff item"}</div>
                          <div className="small">
                            {it.preview || ""} • {fmt(it.createdAt)}
                          </div>
                        </div>
                        <div className="chips">
                          <span className={rb.cls}>{rb.label}</span>
                          {it.status ? <span className="badge">{it.status}</span> : null}
                          {it.visibility ? <span className="badge">{it.visibility}</span> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
