// client/src/ui/OutletInboxPage.tsx (FULL REPLACEMENT)

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { AuthPayload } from "../lib/api";
import { apiGet, apiPost } from "../lib/api";

type InboxItem = {
  id: string;
  orgId: string;
  toUserId: string;
  toUsername: string;
  fromUserId: string;
  fromUsername: string;
  subject: string | null;
  body: string;
  status: "sent" | "acknowledged";
  createdAt: string;
  ackAt?: string | null;
};

function TrustLoopBox() {
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="panelTitle">
        <span>Trust loop</span>
        <span className="badge good">A1</span>
      </div>
      <div className="small" style={{ marginTop: 8, lineHeight: 1.7 }}>
        <b>1) Private first:</b> the employee gets a safe space to think and document.
        <br />
        <b>2) Choice:</b> they can escalate to manager/admin only when ready.
        <br />
        <b>3) Staff response:</b> staff can acknowledge + resolve responsibly (not punish).
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
  const nav = useNavigate();

  const [auth, setAuth] = useState<AuthPayload | null>(null);
  const role = auth?.role;
  const isStaff = role === "admin" || role === "manager";

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // Staff view inbox list
  const [items, setItems] = useState<InboxItem[]>([]);

  // Compose (staff -> user)
  const [toUserId, setToUserId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  async function loadAuth() {
    const me = await apiGet<{ auth: AuthPayload }>("/api/me");
    setAuth(me.auth);
  }

  async function loadInbox() {
    setMsg(null);
    setLoading(true);
    try {
      if (!isStaff) {
        setItems([]);
        setMsg("Inbox is staff-only.");
        return;
      }

      // Current backend endpoints in your project use /api/staff/inbox
      const r = await apiGet<{ items: InboxItem[] }>("/api/staff/inbox");
      setItems(r.items || []);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load inbox.");
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    setMsg(null);
    try {
      if (!isStaff) return;
      const uid = toUserId.trim();
      if (!uid) return setMsg("toUserId is required.");
      if (!body.trim()) return setMsg("Message body is required.");

      await apiPost("/api/staff/inbox", {
        toUserId: uid,
        subject: subject.trim() ? subject.trim() : null,
        body: body.trim(),
      });

      setSubject("");
      setBody("");
      setMsg("Sent.");
      await loadInbox();
    } catch (e: any) {
      setMsg(e?.message || "Failed to send.");
    }
  }

  async function ack(itemId: string) {
    setMsg(null);
    try {
      // NOTE: your current TS error showed ack expects { itemId }, not messageId.
      await apiPost("/api/staff/inbox/ack", { itemId });
      await loadInbox();
    } catch (e: any) {
      setMsg(e?.message || "Failed to acknowledge.");
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
    loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  const sentCount = useMemo(() => items.filter((i) => i.status === "sent").length, [items]);
  const ackCount = useMemo(() => items.filter((i) => i.status === "acknowledged").length, [items]);

  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Inbox</h1>
            <div className="sub">Staff messaging for support, follow-up, and resolution.</div>
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
            <button className="btn" onClick={loadInbox} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>

        <div className="body">
          <TrustLoopBox />

          {msg ? <div className="toast bad">{msg}</div> : null}

          {!isStaff ? (
            <div className="panel">
              <div className="panelTitle">
                <span>Access</span>
                <span className="badge">Staff only</span>
              </div>
              <div className="small" style={{ marginTop: 10 }}>
                This inbox is intended for <b>admin/manager</b> support messaging.
              </div>
            </div>
          ) : (
            <>
              <div className="grid2">
                <div className="panel">
                  <div className="panelTitle">
                    <span>Compose</span>
                    <span className="badge">{role}</span>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div className="label">To userId</div>
                    <input className="input" value={toUserId} onChange={(e) => setToUserId(e.target.value)} placeholder="Paste a userId" />
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div className="label">Subject (optional)</div>
                    <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short subject" />
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <div className="label">Message</div>
                    <textarea className="textarea" rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Supportive, clear, outcome-focused…" />
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <button className="btn primary" onClick={send}>
                      Send
                    </button>
                  </div>

                  <div className="small" style={{ marginTop: 10, lineHeight: 1.6 }}>
                    Tip: Keep messages <b>support-first</b>, document next steps, and avoid judgment language.
                  </div>
                </div>

                <div className="panel">
                  <div className="panelTitle">
                    <span>Staff inbox</span>
                    <span className="badge">
                      sent {sentCount} • ack {ackCount}
                    </span>
                  </div>

                  {loading ? <div className="small" style={{ marginTop: 10 }}>Loading…</div> : null}

                  {!loading && !items.length ? <div className="small" style={{ marginTop: 10 }}>No messages.</div> : null}

                  <div className="list" style={{ marginTop: 10 }}>
                    {items.map((it) => (
                      <div key={it.id} className="listItemStatic">
                        <div className="listTop">
                          <div>
                            <div className="listTitle">{it.subject ? it.subject : "Message"}</div>
                            <div className="small">
                              To <b>{it.toUsername || it.toUserId}</b> • From <b>{it.fromUsername || it.fromUserId}</b> •{" "}
                              {it.createdAt ? new Date(it.createdAt).toLocaleString() : ""}
                            </div>
                          </div>
                          <div className="chips">
                            <span className={`badge ${it.status === "acknowledged" ? "good" : ""}`}>
                              {it.status === "acknowledged" ? "Acknowledged" : "Sent"}
                            </span>
                            {it.status !== "acknowledged" ? (
                              <button className="btn" onClick={() => ack(it.id)}>
                                Acknowledge
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="small" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                          {it.body}
                        </div>

                        {it.ackAt ? (
                          <div className="small" style={{ marginTop: 8 }}>
                            Ack at {new Date(it.ackAt).toLocaleString()}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
