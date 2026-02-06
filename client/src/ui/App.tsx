// client/src/ui/App.tsx (FULL REPLACEMENT)
import React from "react";
import { Routes, Route, Navigate, Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { getToken, setToken } from "../lib/api";
import AuthPage from "./AuthPage";
import DashboardPage from "./DashboardPage";
import LandingPage from "./LandingPage";
import InviteAcceptPage from "./InviteAcceptPage";
import ResetPage from "./ResetPage";

/** -------- Outlet UI (single-file MVP) -------- */

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

/**
 * Use the same base resolution rules as lib/api.ts:
 * - if VITE_API_BASE is set, use it
 * - otherwise same-origin
 */
const API_BASE = ((import.meta as any)?.env?.VITE_API_BASE || "").toString().replace(/\/+$/, "");
function apiUrl(path: string) {
  if (!path.startsWith("/")) path = `/${path}`;
  return `${API_BASE}${path}`;
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(init.headers || {});
  headers.set("Accept", "application/json");
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(apiUrl(path), { ...init, headers });

  // Safe parse: handle 204 / non-json / html errors without crashing
  const text = await res.text().catch(() => "");
  const json = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return {};
        }
      })()
    : {};

  if (!res.ok) {
    const msg =
      (json as any)?.error?.message ||
      (json as any)?.error ||
      (json as any)?.message ||
      `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Request failed");
  }
  return json;
}

function OutletHomePage() {
  const nav = useNavigate();

  const [sessions, setSessions] = React.useState<OutletSession[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const [category, setCategory] = React.useState<string>("");
  const [visibility, setVisibility] = React.useState<"private" | "manager" | "admin">("private");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiFetch("/api/outlet/sessions");
      setSessions((data as any).sessions || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    setErr(null);
    try {
      const data = await apiFetch("/api/outlet/sessions", {
        method: "POST",
        body: JSON.stringify({
          category: category.trim() ? category.trim() : null,
          visibility,
        }),
      });
      const s: OutletSession = (data as any).session;
      nav(`/outlet/${s.id}`);
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
        <div className="sub">Private outlet + AI-guided support. You can choose whether to escalate.</div>

        {err ? (
          <div className="badge" style={{ marginTop: 8 }}>
            {err}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <div>
            <div className="sub" style={{ marginBottom: 6 }}>
              Start a new session
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                className="input"
                placeholder="Category (burnout, scheduling, conflict, pay, safety...)"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ flex: "1 1 260px" }}
              />
              <select
                className="input"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as any)}
                style={{ flex: "0 0 200px" }}
              >
                <option value="private">Private (AI only)</option>
                <option value="manager">Visible to manager</option>
                <option value="admin">Visible to admin</option>
              </select>
              <button className="btn" onClick={create}>
                Create
              </button>
              <button className="btn" onClick={load}>
                Refresh
              </button>
            </div>
            <div className="sub" style={{ marginTop: 8 }}>
              Tip: If you choose “Private,” managers/admin won’t see it unless you escalate it.
            </div>
          </div>

          <hr />

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3 style={{ margin: 0 }}>My Sessions</h3>
              {loading ? <span className="badge">Loading…</span> : <span className="badge">{sessions.length}</span>}
            </div>

            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {sessions.length === 0 && !loading ? <div className="sub">No sessions yet. Create one above.</div> : null}

              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="card"
                  style={{ cursor: "pointer" }}
                  onClick={() => nav(`/outlet/${s.id}`)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{s.category ? s.category : "General"}</div>
                      <div className="sub">
                        {s.status} • {s.visibility} • updated {new Date(s.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {s.status === "escalated" ? <span className="badge">Escalated</span> : null}
                      {s.status === "closed" ? <span className="badge">Closed</span> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <hr />

          <OutletStaffPanel />
        </div>
      </div>
    </div>
  );
}

/**
 * Staff panel:
 * - hidden by default
 * - shows if ?staff=1 is in URL
 * Backend still enforces manager/admin.
 */
function OutletStaffPanel() {
  const loc = useLocation();
  const params = new URLSearchParams(loc.search);
  const staffEnabled = params.get("staff") === "1";

  const [open, setOpen] = React.useState(false);
  const [sessions, setSessions] = React.useState<OutletSession[]>([]);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function loadStaff() {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiFetch("/api/outlet/sessions?view=staff&limit=200");
      setSessions((data as any).sessions || []);
      setOpen(true);
    } catch (e: any) {
      setErr(e?.message || "Could not load staff view (need manager/admin)");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  if (!staffEnabled) return null;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn" onClick={loadStaff} disabled={loading}>
          {loading ? "Loading…" : "Open Staff View (manager/admin)"}
        </button>
        {err ? <span className="badge">{err}</span> : null}
        {open ? <span className="badge">{sessions.length} visible sessions</span> : null}
      </div>

      {open ? (
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {sessions.map((s) => (
            <div key={s.id} className="card">
              <div style={{ fontWeight: 700 }}>{s.category || "General"}</div>
              <div className="sub">
                status: {s.status} • visibility: {s.visibility} • updated {new Date(s.updatedAt).toLocaleString()}
              </div>
              <div className="sub">sessionId: {s.id}</div>
            </div>
          ))}
        </div>
      ) : null}
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
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiFetch(`/api/outlet/sessions/${sessionId}`);
      setSession((data as any).session);
      setMessages((data as any).messages || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load session");
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const text = content.trim();
    if (!text) return;
    setSending(true);
    setErr(null);
    try {
      const data = await apiFetch(`/api/outlet/sessions/${sessionId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: text }),
      });

      const userMessage: OutletMessage | undefined = (data as any).userMessage;
      const aiMessage: OutletMessage | undefined = (data as any).aiMessage;
      setMessages((prev) => [...prev, ...(userMessage ? [userMessage] : []), ...(aiMessage ? [aiMessage] : [])]);
      setContent("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  }

  async function requestEscalation(role: "manager" | "admin") {
    setErr(null);
    try {
      await apiFetch(`/api/outlet/sessions/${sessionId}/escalate`, {
        method: "POST",
        body: JSON.stringify({
          escalatedToRole: role,
          reason: "Employee requested escalation.",
        }),
      });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to escalate");
    }
  }

  async function close() {
    setErr(null);
    try {
      await apiFetch(`/api/outlet/sessions/${sessionId}/close`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to close session");
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div>
            <h2 style={{ marginBottom: 4 }}>Outlet Session</h2>
            {session ? (
              <div className="sub">
                {session.category || "General"} • {session.status} • {session.visibility}
              </div>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => nav("/outlet")}>
              Back
            </button>
            <button className="btn" onClick={() => requestEscalation("manager")}>
              Escalate to Manager
            </button>
            <button className="btn" onClick={() => requestEscalation("admin")}>
              Escalate to Admin
            </button>
            <button className="btn" onClick={close}>
              Close
            </button>
          </div>
        </div>

        {err ? (
          <div className="badge" style={{ marginTop: 10 }}>
            {err}
          </div>
        ) : null}
        {loading ? (
          <div className="badge" style={{ marginTop: 10 }}>
            Loading…
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          <div className="card" style={{ maxHeight: 420, overflow: "auto" }}>
            {messages.length === 0 ? <div className="sub">No messages yet. Say what’s on your mind.</div> : null}
            {messages.map((m) => (
              <div key={m.id} style={{ marginBottom: 12 }}>
                <div className="sub" style={{ marginBottom: 4 }}>
                  <b>{m.sender === "ai" ? "AI" : "You"}</b> • {new Date(m.createdAt).toLocaleString()}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <textarea
              className="input"
              rows={4}
              placeholder="Type your message…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{ flex: 1 }}
            />
            <button className="btn" onClick={send} disabled={sending || !content.trim()}>
              {sending ? "Sending…" : "Send"}
            </button>
          </div>

          <div className="sub">If this is an immediate safety issue, contact local emergency services or your company’s emergency process.</div>
        </div>
      </div>
    </div>
  );
}

/** -------- App Shell -------- */

function Topbar() {
  const nav = useNavigate();
  const token = getToken();
  return (
    <div className="container">
      <div className="card hdr">
        <div>
          <h1>Level Up</h1>
          <div className="sub">Daily structure • habits • honest reflection</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <Topbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/about" element={<LandingPage />} />
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

        {/* Outlet / Counselor’s Office */}
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
