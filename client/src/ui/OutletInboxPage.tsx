// client/src/ui/OutletInboxPage.tsx (FULL REPLACEMENT)

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api";

type UserInboxItem = {
  id: string;
  orgId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  severity: number;
  createdAt: string;
  readAt: string | null;
  ackAt: string | null;
  isRead: boolean;
  isAcked: boolean;
};

type StaffThreadMessage = {
  id: string;
  orgId: string;
  userId: string; // employee
  staffUserId: string; // sender staff id
  staffUsername?: string | null;
  content: string;
  createdAt: string;
};

function TrustLoopBox() {
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="panelTitle">
        <span>Trust loop</span>
        <span className="badge good">A2</span>
      </div>
      <div className="small" style={{ marginTop: 8, lineHeight: 1.7 }}>
        <b>1) Private first:</b> employee gets a safe space to think and document.
        <br />
        <b>2) Choice:</b> escalate to manager/admin only when ready.
        <br />
        <b>3) Staff response:</b> acknowledge + resolve responsibly (not punish).
        <br />
        <b>4) Patterns:</b> org sees trends that affect wellbeing/retention/safety — without stripping dignity.
        <br />
        <br />
        Want the doctrine? <Link to="/visibility">Responsible Visibility</Link>.
      </div>
    </div>
  );
}

export default function OutletInboxPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // We don't rely on /api/me (not present in server/routes.ts).
  // Instead, we "discover" staff access by trying /api/users (admin/manager only).
  const [isStaff, setIsStaff] = useState<boolean>(false);

  // User inbox (everyone can see their own inbox)
  const [userItems, setUserItems] = useState<UserInboxItem[]>([]);

  // Staff thread view (manager/admin only)
  const [targetUserId, setTargetUserId] = useState("");
  const [thread, setThread] = useState<StaffThreadMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  // Compose (staff -> employee)
  const [compose, setCompose] = useState("");

  async function detectStaff() {
    try {
      await apiGet<{ users: any[] }>("/api/users");
      setIsStaff(true);
    } catch {
      setIsStaff(false);
    }
  }

  async function loadUserInbox() {
    try {
      const r = await apiGet<{ items: UserInboxItem[] }>("/api/inbox");
      setUserItems(r.items || []);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load inbox.");
    }
  }

  async function markRead(itemId: string) {
    try {
      await apiPost<{ ok: boolean }>(`/api/inbox/${encodeURIComponent(itemId)}/read`, {});
      await loadUserInbox();
    } catch (e: any) {
      setMsg(e?.message || "Failed to mark read.");
    }
  }

  async function ack(itemId: string) {
    try {
      await apiPost<{ ok: boolean }>(`/api/inbox/${encodeURIComponent(itemId)}/ack`, {});
      await loadUserInbox();
    } catch (e: any) {
      setMsg(e?.message || "Failed to acknowledge.");
    }
  }

  async function loadThread() {
    setMsg(null);
    const uid = targetUserId.trim();
    if (!uid) {
      setThread([]);
      return setMsg("Enter a userId to load the staff thread.");
    }

    setThreadLoading(true);
    try {
      const r = await apiGet<{ messages: StaffThreadMessage[] }>(
        `/api/staff/inbox/messages?userId=${encodeURIComponent(uid)}&limit=300`,
      );
      setThread(r.messages || []);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load staff thread.");
      setThread([]);
    } finally {
      setThreadLoading(false);
    }
  }

  async function sendToUser() {
    setMsg(null);
    const uid = targetUserId.trim();
    const content = compose.trim();

    if (!uid) return setMsg("Enter a userId before sending.");
    if (!content) return setMsg("Message content is required.");

    try {
      await apiPost<{ message: any }>("/api/staff/inbox/messages", { userId: uid, content });
      setCompose("");
      setMsg("Sent.");
      await loadThread();
      // also refresh the sender's own inbox view (optional)
      await loadUserInbox();
    } catch (e: any) {
      setMsg(e?.message || "Failed to send.");
    }
  }

  async function refreshAll() {
    setMsg(null);
    setLoading(true);
    try {
      await detectStaff();
      await loadUserInbox();
      // if staff already has a target selected, refresh it too
      if (isStaff && targetUserId.trim()) {
        await loadThread();
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await detectStaff();
        await loadUserInbox();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = useMemo(() => userItems.filter((i) => !i.isRead).length, [userItems]);
  const unackedCount = useMemo(() => userItems.filter((i) => !i.isAcked).length, [userItems]);

  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Inbox</h1>
            <div className="sub">Support messaging + acknowledgements + responsible follow-up.</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link className="btn" to="/dashboard">
              Dashboard
            </Link>
            <Link className="btn" to="/outlet">
              Counselor’s Office
            </Link>
            <Link className="btn" to="/visibility">
              Visibility
            </Link>
            <button className="btn" onClick={refreshAll} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        <div className="body">
          <TrustLoopBox />

          {msg ? <div className="toast bad">{msg}</div> : null}

          <div className="grid2">
            {/* USER INBOX (everyone) */}
            <div className="panel">
              <div className="panelTitle">
                <span>Your inbox</span>
                <span className="badge">
                  unread {unreadCount} • unacked {unackedCount}
                </span>
              </div>

              {loading ? <div className="small" style={{ marginTop: 10 }}>Loading…</div> : null}

              {!loading && !userItems.length ? (
                <div className="small" style={{ marginTop: 10 }}>
                  No items yet.
                </div>
              ) : null}

              <div className="list" style={{ marginTop: 10 }}>
                {userItems.map((it) => (
                  <div key={it.id} className="listItemStatic">
                    <div className="listTop">
                      <div>
                        <div className="listTitle">{it.title || "Message"}</div>
                        <div className="small">
                          {it.type ? <span className="badge">{it.type}</span> : null}{" "}
                          {it.createdAt ? `• ${new Date(it.createdAt).toLocaleString()}` : ""}
                        </div>
                      </div>

                      <div className="chips">
                        <span className={`badge ${it.isAcked ? "good" : ""}`}>{it.isAcked ? "Acked" : "Needs ack"}</span>
                        <span className={`badge ${it.isRead ? "good" : ""}`}>{it.isRead ? "Read" : "Unread"}</span>

                        {!it.isRead ? (
                          <button className="btn" onClick={() => markRead(it.id)}>
                            Mark read
                          </button>
                        ) : null}

                        {!it.isAcked ? (
                          <button className="btn" onClick={() => ack(it.id)}>
                            Acknowledge
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="small" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                      {it.body}
                    </div>

                    {(it.readAt || it.ackAt) ? (
                      <div className="small" style={{ marginTop: 8 }}>
                        {it.readAt ? `Read: ${new Date(it.readAt).toLocaleString()}` : ""}
                        {it.readAt && it.ackAt ? " • " : ""}
                        {it.ackAt ? `Ack: ${new Date(it.ackAt).toLocaleString()}` : ""}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {/* STAFF THREAD (admin/manager only) */}
            <div className="panel">
              <div className="panelTitle">
                <span>Staff thread</span>
                <span className="badge">{isStaff ? "admin/manager" : "staff only"}</span>
              </div>

              {!isStaff ? (
                <div className="small" style={{ marginTop: 10 }}>
                  Staff threads are available to <b>admin/manager</b>.
                </div>
              ) : (
                <>
                  <div style={{ marginTop: 10 }}>
                    <div className="label">Employee userId</div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <input
                        className="input"
                        value={targetUserId}
                        onChange={(e) => setTargetUserId(e.target.value)}
                        placeholder="Paste employee userId"
                      />
                      <button className="btn" onClick={loadThread} disabled={threadLoading}>
                        {threadLoading ? "Loading…" : "Load"}
                      </button>
                    </div>
                    <div className="small" style={{ marginTop: 8 }}>
                      This pulls from <code>/api/staff/inbox/messages</code>.
                    </div>
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div className="label">Send message</div>
                    <textarea
                      className="textarea"
                      rows={4}
                      value={compose}
                      onChange={(e) => setCompose(e.target.value)}
                      placeholder="Supportive, clear, outcome-focused…"
                    />
                    <div style={{ marginTop: 10 }}>
                      <button className="btn primary" onClick={sendToUser}>
                        Send
                      </button>
                    </div>
                  </div>

                  <div className="small" style={{ marginTop: 10, lineHeight: 1.6 }}>
                    Tip: Keep messages <b>support-first</b>, document next steps, avoid judgment language.
                  </div>

                  <hr />

                  {threadLoading ? <div className="small">Loading thread…</div> : null}
                  {!threadLoading && targetUserId.trim() && !thread.length ? <div className="small">No messages yet.</div> : null}

                  <div className="list" style={{ marginTop: 10 }}>
                    {thread.map((m) => (
                      <div key={m.id} className="listItemStatic">
                        <div className="listTop">
                          <div>
                            <div className="listTitle">Staff message</div>
                            <div className="small">
                              From <b>{m.staffUsername || m.staffUserId}</b> •{" "}
                              {m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}
                            </div>
                          </div>
                        </div>
                        <div className="small" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
