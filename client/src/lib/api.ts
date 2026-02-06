import React from "react";
import { Routes, Route, Navigate, Link, useNavigate, useParams } from "react-router-dom";
import { api, getToken, setToken } from "../lib/api";
import AuthPage from "./AuthPage";
import DashboardPage from "./DashboardPage";
import LandingPage from "./LandingPage";
import InviteAcceptPage from "./InviteAcceptPage";
import ResetPage from "./ResetPage";

/* ---------------- Outlet (Counselor’s Office) ---------------- */

type OutletSession = {
  id: string;
  orgId: string;
  userId: string;
  visibility: "private" | "manager" | "admin";
  category: string | null;
  status: "open" | "escalated" | "closed";
  riskLevel: number;
  createdAt: string;
  updatedAt: string;
};

type OutletMessage = {
  id: string;
  orgId: string;
  sessionId: string;
  sender: "user" | "ai";
  content: string;
  createdAt: string;
};

function OutletHomePage() {
  const nav = useNavigate();
  const [sessions, setSessions] = React.useState<OutletSession[]>([]);
  const [category, setCategory] = React.useState("");
  const [visibility, setVisibility] = React.useState<"private" | "manager" | "admin">("private");
  const [err, setErr] = React.useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const res = await api.outletListMySessions();
      setSessions(res.sessions || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load sessions");
    }
  }

  async function create() {
    setErr(null);
    try {
      const res = await api.outletCreateSession({
        category: category.trim() || null,
        visibility,
      });
      nav(`/outlet/${res.session.id}`);
    } catch (e: any) {
      setErr(e?.message || "Failed to create session");
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  return (
    <div className="container">
      <div className="card">
        <h2>Counselor’s Office</h2>
        <div className="sub">
          A private, AI-guided space to process concerns while you’re still employed.
        </div>

        {err ? <div className="badge">{err}</div> : null}

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder="Category (burnout, pay, schedule, conflict…)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <select
            className="input"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as any)}
          >
            <option value="private">Private (AI only)</option>
            <option value="manager">Visible to manager</option>
            <option value="admin">Visible to admin</option>
          </select>
          <button className="btn" onClick={create}>
            Start
          </button>
          <button className="btn" onClick={load}>
            Refresh
          </button>
        </div>

        <hr />

        {sessions.length === 0 ? (
          <div className="sub">No sessions yet. Create one above.</div>
        ) : null}

        {sessions.map((s) => (
          <div
            key={s.id}
            className="card"
            style={{ cursor: "pointer" }}
            onClick={() => nav(`/outlet/${s.id}`)}
          >
            <b>{s.category || "General"}</b>
            <div className="sub">
              {s.status} • {s.visibility}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OutletSessionPage() {
  const { id } = useParams();
  const sessionId = String(id || "");
  const nav = useNavigate();

  const [session, setSession] = React.useState<OutletSession | null>(null);
  const [messages, setMessages] = React.useState<OutletMessage[]>([]);
  const [content, setContent] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);

  async function load() {
    setErr(null);
    try {
      const res = await api.outletGetSession(sessionId);
      setSession(res.session);
      setMessages(res.messages || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load session");
    }
  }

  async function send() {
    const text = content.trim();
    if (!text) return;
    setSending(true);
    setErr(null);
    try {
      await api.outletSendMessage(sessionId, text);
      setContent("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function escalate(role: "manager" | "admin") {
    setErr(null);
    try {
      await api.outletEscalate(sessionId, {
        escalatedToRole: role,
        reason: "Employee requested escalation",
      });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to escalate");
    }
  }

  async function close() {
    setErr(null);
    try {
      await api.outletClose(sessionId);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to close session");
    }
  }

  React.useEffect(() => {
    if (!sessionId) return;
    load();
  }, [sessionId]);

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => nav("/outlet")}>
            ← Back
          </button>
          <button className="btn" onClick={() => escalate("manager")}>
            Escalate to Manager
          </button>
          <button className="btn" onClick={() => escalate("admin")}>
            Escalate to Admin
          </button>
          <button className="btn" onClick={close}>
            Close
          </button>
        </div>

        {session ? (
          <>
            <h2 style={{ marginTop: 12 }}>{session.category || "General"}</h2>
            <div className="sub">
              {session.status} • {session.visibility}
            </div>
          </>
        ) : null}

        {err ? <div className="badge" style={{ marginTop: 10 }}>{err}</div> : null}

        <div className="card" style={{ maxHeight: 400, overflow: "auto", marginTop: 12 }}>
          {messages.length === 0 ? (
            <div className="sub">No messages yet. Say what’s on your mind.</div>
          ) : null}

          {messages.map((m) => (
            <div key={m.id} style={{ marginBottom: 12 }}>
              <div className="sub" style={{ marginBottom: 4 }}>
                <b>{m.sender === "ai" ? "AI" : "You"}</b> • {new Date(m.createdAt).toLocaleString()}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
            </div>
          ))}
        </div>

        <textarea
          className="input"
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Say what’s on your mind…"
          style={{ marginTop: 10 }}
        />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <button className="btn" onClick={send} disabled={sending || !content.trim()}>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>

        <div className="sub" style={{ marginTop: 10 }}>
          If this is an immediate safety issue, contact local emergency services or your company’s emergency process.
        </div>
      </div>
    </div>
  );
}

/* ---------------- App Shell ---------------- */

function Topbar() {
  const nav = useNavigate();
  const token = getToken();
  return (
    <div className="container">
      <div className="card hdr">
        <h1>Level Up</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="badge" to="/">
            About
          </Link>
          <Link className="badge" to="/dashboard">
            Dashboard
          </Link>
          {token ? (
            <Link className="badge" to="/outlet">
              Counselor’s Office
            </Link>
          ) : null}
          {token ? (
            <button
              className="btn"
              onClick={() => {
                setToken(null);
                nav("/login");
              }}
            >
              Log out
            </button>
          ) : (
            <span className="badge">Not logged in</span>
          )}
        </div>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
      <Topbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/invite/:token" element={<InviteAcceptPage />} />
        <Route path="/reset" element={<ResetPage />} />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />

        <Route
          path="/outlet"
          element={
            <RequireAuth>
              <OutletHomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/outlet/:id"
          element={
            <RequireAuth>
              <OutletSessionPage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
