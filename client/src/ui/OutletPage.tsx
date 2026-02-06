import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AuthPayload, Role } from "../lib/api";
import { api, apiGet } from "../lib/api";

type OutletVisibility = "private" | "manager" | "admin";
type OutletStatus = "open" | "escalated" | "closed";

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
  if (s === "closed") return "Closed";
  if (s === "escalated") return "Escalated";
  return "Open";
}

export function OutletHomePage() {
  const nav = useNavigate();

  const [auth, setAuth] = useState<AuthPayload | null>(null);
  const role = auth?.role as Role | undefined;
  const isStaff = role === "admin" || role === "manager";
  const isAdmin = role === "admin";

  const [view, setView] = useState<"mine" | "staff">("mine");
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // Create form
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState<OutletVisibility>("private");

  async function loadAuth() {
    const me = await apiGet<{ auth: AuthPayload }>("/api/me");
    setAuth(me.auth);
  }

  async function loadSessions(nextView = view) {
    setMsg(null);
    setLoading(true);
    try {
      if (nextView === "staff" && isStaff) {
        const r = await api.outletListStaffSessions(200);
        setSessions(r.sessions || []);
      } else {
        const r = await api.outletListMySessions(50);
        setSessions(r.sessions || []);
      }
    } catch (e: any) {
      setMsg(e.message || "Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }

  async function createSession() {
    setMsg(null);
    try {
      const r = await api.outletCreateSession({
        category: category.trim() ? category.trim() : null,
        visibility,
      });
      nav(`/outlet/${r.session.id}`);
    } catch (e: any) {
      setMsg(e.message || "Failed to create session.");
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await loadAuth();
      } catch {
        nav("/login");
        return;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auth) return;
    loadSessions("mine");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  const viewLabel = useMemo(() => {
    if (view === "staff") return "Staff view";
    return "My sessions";
  }, [view]);

  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Counselor’s Office</h1>
            <div className="sub">Private outlet + documentation + escalation (if needed).</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Link className="btn" to="/dashboard">
              Dashboard
            </Link>
            <button className="btn primary" onClick={createSession}>
              New session
            </button>
          </div>
        </div>

        <div className="body">
          <div className="grid2">
            <div className="panel">
              <div className="panelTitle">
                <span>Create a new session</span>
                <span className="badge">{visLabel(visibility)} visibility</span>
              </div>

              <div className="row" style={{ marginTop: 12 }}>
                <div className="col">
                  <div className="label">Category (optional)</div>
                  <input
                    className="input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="pay, scheduling, conflict, safety…"
                  />
                </div>

                <div className="col" style={{ flexBasis: 240 }}>
                  <div className="label">Visibility</div>
                  <select
                    className="select"
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as OutletVisibility)}
                  >
                    <option value="private">private (only you)</option>
                    <option value="manager">manager</option>
                    <option value="admin">admin</option>
                  </select>
                  {!isAdmin && visibility === "admin" ? (
                    <div className="small" style={{ marginTop: 6 }}>
                      Note: only admins can view admin-only sessions.
                    </div>
                  ) : null}
                </div>

                <div className="col" style={{ flexBasis: 180, alignSelf: "flex-end" }}>
                  <button className="btn primary" onClick={createSession}>
                    Start
                  </button>
                </div>
              </div>

              <div className="small" style={{ marginTop: 10 }}>
                Tip: Keep “private” unless you’re ready for management to see it.
              </div>

              {msg ? <div className="toast bad">{msg}</div> : null}
            </div>

            <div className="panel">
              <div className="panelTitle">
                <span>{viewLabel}</span>

                {isStaff ? (
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
                    >
                      Staff
                    </button>
                    <button className="btn" onClick={() => loadSessions()}>
                      Refresh
                    </button>
                  </div>
                ) : (
                  <button className="btn" onClick={() => loadSessions()}>
                    Refresh
                  </button>
                )}
              </div>

              {loading ? <div className="small" style={{ marginTop: 12 }}>Loading…</div> : null}

              {!loading && sessions.length === 0 ? (
                <div className="small" style={{ marginTop: 12 }}>No sessions yet.</div>
              ) : null}

              <div className="list">
                {sessions.map((s) => {
                  const rb = riskBadge(Number(s.riskLevel || 0));
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
                            {statusLabel(s.status)} • {visLabel(s.visibility)} •{" "}
                            {new Date(s.createdAt).toLocaleString()}
                          </div>
                        </div>

                        <div className="chips">
                          <span className={rb.cls}>{rb.label}</span>
                          {s.status === "closed" ? <span className="badge">Closed</span> : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="small" style={{ marginTop: 10 }}>
                Staff view shows sessions only when visibility permits (manager/admin rules).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OutletSessionPage() {
  const nav = useNavigate();
  const { id } = useParams();

  const [auth, setAuth] = useState<AuthPayload | null>(null);
  const role = auth?.role as Role | undefined;
  const isStaff = role === "admin" || role === "manager";

  const [session, setSession] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "good" | "bad"; text: string } | null>(null);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // Escalation UI
  const [escalateTo, setEscalateTo] = useState<"manager" | "admin">("manager");
  const [assignToUserId, setAssignToUserId] = useState("");
  const [reason, setReason] = useState("");

  const isOwner = !!(auth?.userId && session?.userId && auth.userId === session.userId);
  const canEscalate = isOwner || isStaff;
  const canClose = isOwner || isStaff;

  async function loadAuth() {
    const me = await apiGet<{ auth: AuthPayload }>("/api/me");
    setAuth(me.auth);
  }

  async function load() {
    if (!id) return;
    setToast(null);
    setLoading(true);
    try {
      const r = await api.outletGetSession(id);
      setSession(r.session);
      setMessages(r.messages || []);
    } catch (e: any) {
      setToast({ type: "bad", text: e.message || "Failed to load session." });
      setTimeout(() => nav("/outlet"), 350);
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    if (!id) return;
    const text = input.trim();
    if (!text) return;

    setSending(true);
    setToast(null);
    try {
      const r = await api.outletSendMessage(id, text);
      setInput("");
      setMessages((m) => [...m, r.userMessage, r.aiMessage]);
      if (Number(r.riskLevel || 0) >= 2) {
        setToast({ type: "bad", text: "Safety/risk keywords detected → auto-escalated to admin." });
      }
    } catch (e: any) {
      setToast({ type: "bad", text: e.message || "Failed to send message." });
    } finally {
      setSending(false);
    }
  }

  async function escalate() {
    if (!id || !canEscalate) return;
    setToast(null);
    try {
      await api.outletEscalate(id, {
        escalatedToRole: escalateTo,
        assignedToUserId: assignToUserId.trim() ? assignToUserId.trim() : null,
        reason: reason.trim() ? reason.trim() : null,
      });
      setToast({ type: "good", text: `Escalated to ${escalateTo}.` });
      await load();
    } catch (e: any) {
      setToast({ type: "bad", text: e.message || "Escalation failed." });
    }
  }

  async function closeSession() {
    if (!id || !canClose) return;
    setToast(null);
    try {
      await api.outletClose(id);
      setToast({ type: "good", text: "Session closed." });
      await load();
    } catch (e: any) {
      setToast({ type: "bad", text: e.message || "Close failed." });
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await loadAuth();
        await load();
      } catch {
        nav("/login");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const rb = riskBadge(Number(session?.riskLevel || 0));

  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Counselor’s Office</h1>
            <div className="sub">
              {session ? (
                <>
                  {session.category ? session.category : "General"} • {statusLabel(session.status)} •{" "}
                  {visLabel(session.visibility)}
                </>
              ) : (
                "Session"
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn" to="/outlet">
              Back
            </Link>
            <button className="btn" onClick={load} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        <div className="body">
          {toast ? <div className={`toast ${toast.type}`}>{toast.text}</div> : null}

          {loading ? <div className="small">Loading…</div> : null}

          {!loading && session ? (
            <div className="grid2">
              <div className="panel">
                <div className="panelTitle">
                  <span>Conversation</span>
                  <span className={rb.cls}>{rb.label}</span>
                </div>

                <div className="chatBox" style={{ marginTop: 12 }}>
                  <div className="chatList">
                    {messages.map((m) => (
                      <div key={m.id} className={`bubble ${m.sender === "user" ? "user" : "ai"}`}>
                        <div className="bubbleMeta">
                          <span>{m.sender === "user" ? "You" : "Counselor"}</span>
                          <span>{m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}</span>
                        </div>
                        <div className="bubbleText">{m.content}</div>
                      </div>
                    ))}
                    {!messages.length ? <div className="small">No messages yet.</div> : null}
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  {!isOwner ? (
                    <div className="small">
                      You’re viewing as staff. Messages are read-only in this MVP (only the owner can send).
                    </div>
                  ) : null}

                  <div className="row" style={{ marginTop: 10, alignItems: "flex-end" }}>
                    <div className="col">
                      <div className="label">Message</div>
                      <textarea
                        className="textarea"
                        rows={3}
                        placeholder="Type what’s on your mind…"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={!isOwner || sending || session.status === "closed"}
                      />
                    </div>
                    <div className="col" style={{ flexBasis: 160 }}>
                      <button
                        className="btn primary"
                        onClick={send}
                        disabled={!isOwner || sending || !input.trim() || session.status === "closed"}
                      >
                        {sending ? "Sending…" : "Send"}
                      </button>
                    </div>
                  </div>

                  {session.status === "closed" ? (
                    <div className="small" style={{ marginTop: 10 }}>
                      This session is closed. You can start a new session anytime.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="panel">
                <div className="panelTitle">
                  <span>Actions</span>
                  <span className="badge">{isOwner ? "Owner" : isStaff ? "Staff" : "Viewer"}</span>
                </div>

                <div className="list" style={{ marginTop: 12 }}>
                  <div className="listItemStatic">
                    <div className="listTop">
                      <div>
                        <div className="listTitle">Status</div>
                        <div className="small">{statusLabel(session.status)}</div>
                      </div>
                      <div className="chips">
                        <span className="badge">{visLabel(session.visibility)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="listItemStatic">
                    <div className="listTitle">Escalate</div>
                    <div className="small" style={{ marginTop: 6 }}>
                      Share this with management/admin (with your control).
                    </div>

                    <div className="row" style={{ marginTop: 10 }}>
                      <div className="col" style={{ flexBasis: 200 }}>
                        <div className="label">Escalate to</div>
                        <select
                          className="select"
                          value={escalateTo}
                          onChange={(e) => setEscalateTo(e.target.value as any)}
                          disabled={!canEscalate || session.status === "closed"}
                        >
                          <option value="manager">manager</option>
                          <option value="admin">admin</option>
                        </select>
                      </div>

                      <div className="col">
                        <div className="label">Assign to userId (optional)</div>
                        <input
                          className="input"
                          value={assignToUserId}
                          onChange={(e) => setAssignToUserId(e.target.value)}
                          placeholder="(optional) paste a staff userId"
                          disabled={!canEscalate || session.status === "closed"}
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <div className="label">Reason (optional)</div>
                      <textarea
                        className="textarea"
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Short reason for escalation…"
                        disabled={!canEscalate || session.status === "closed"}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                      <button className="btn primary" onClick={escalate} disabled={!canEscalate || session.status === "closed"}>
                        Escalate
                      </button>
                      <button className="btn danger" onClick={closeSession} disabled={!canClose || session.status === "closed"}>
                        Close session
                      </button>
                    </div>

                    {!canEscalate ? (
                      <div className="small" style={{ marginTop: 10 }}>
                        You don’t have permission to escalate this session.
                      </div>
                    ) : null}
                  </div>

                  <div className="listItemStatic">
                    <div className="listTitle">What this does (MVP)</div>
                    <div className="small" style={{ marginTop: 6 }}>
                      • Escalation changes visibility/state on the backend.
                      <br />
                      • Staff can view only when visibility permits.
                      <br />
                      • Sending is owner-only (safe default).
                      <br />
                      • Closing locks the session.
                    </div>
                  </div>
                </div>

                <div className="small" style={{ marginTop: 12 }}>
                  If you want “staff can reply” later, we’ll add a staff message endpoint + audit logs.
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
