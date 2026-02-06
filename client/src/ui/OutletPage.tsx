import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

/* ----------------------------------------
   Outlet Home (session list + create)
----------------------------------------- */

export function OutletHomePage() {
  const nav = useNavigate();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      const r = await api.outletListMySessions(50);
      setSessions(r.sessions || []);
    } catch (e: any) {
      setError(e.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }

  async function createSession() {
    try {
      const r = await api.outletCreateSession({ visibility: "private" });
      nav(`/outlet/${r.session.id}`);
    } catch (e: any) {
      alert(e.message || "Failed to create session");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Counselor’s Office</h1>
            <div className="sub">
              A private space to talk, document, or escalate concerns.
            </div>
          </div>
          <button className="btn primary" onClick={createSession}>
            New session
          </button>
        </div>

        <div className="body">
          {loading && <div className="small">Loading…</div>}
          {error && <div className="small" style={{ color: "var(--bad)" }}>{error}</div>}

          {!loading && sessions.length === 0 && (
            <div className="small">No sessions yet.</div>
          )}

          <div className="row">
            {sessions.map((s) => (
              <div key={s.id} className="col">
                <div
                  className="card body"
                  style={{ cursor: "pointer" }}
                  onClick={() => nav(`/outlet/${s.id}`)}
                >
                  <div style={{ fontWeight: 700 }}>
                    Session
                  </div>
                  <div className="small">
                    Status: {s.status}
                  </div>
                  <div className="small">
                    Created: {new Date(s.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------
   Outlet Session (chat view)
----------------------------------------- */

export function OutletSessionPage() {
  const { id } = useParams();
  const nav = useNavigate();

  const [messages, setMessages] = useState<any[]>([]);
  const [session, setSession] = useState<any | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!id) return;
    try {
      const r = await api.outletGetSession(id);
      setSession(r.session);
      setMessages(r.messages || []);
    } catch (e: any) {
      alert(e.message || "Failed to load session");
      nav("/outlet");
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    if (!id || !input.trim()) return;
    const text = input.trim();
    setInput("");

    try {
      const r = await api.outletSendMessage(id, text);
      setMessages((m) => [...m, r.userMessage, r.aiMessage]);
    } catch (e: any) {
      alert(e.message || "Failed to send message");
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Counselor’s Office</h1>
            <div className="sub">Private conversation</div>
          </div>
          <Link to="/outlet" className="btn">
            Back
          </Link>
        </div>

        <div className="body">
          {loading && <div className="small">Loading…</div>}

          {!loading && (
            <>
              <div
                style={{
                  maxHeight: 420,
                  overflow: "auto",
                  display: "grid",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className="card"
                    style={{
                      background:
                        m.sender === "user"
                          ? "rgba(34,197,94,.10)"
                          : "rgba(59,130,246,.10)",
                    }}
                  >
                    <div className="small">
                      {m.sender === "user" ? "You" : "Counselor"}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                  </div>
                ))}
              </div>

              <div className="row">
                <div className="col">
                  <textarea
                    className="textarea"
                    rows={3}
                    placeholder="Type what’s on your mind…"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                </div>
                <div className="col" style={{ flexBasis: 160 }}>
                  <button className="btn primary" onClick={send}>
                    Send
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
