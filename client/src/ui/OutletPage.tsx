// client/src/ui/OutletPage.tsx (NEW FILE)
import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { AuthPayload, OutletSession, OutletVisibility, OutletMessage } from "../lib/api";
import { api, apiGet } from "../lib/api";

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">{title}</div>
          {subtitle ? <div className="mt-1 text-sm text-white/60">{subtitle}</div> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Button({
  children,
  onClick,
  type = "button",
  disabled,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: "primary" | "ghost";
}) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition border";
  const styles =
    variant === "primary"
      ? "border-white/10 bg-white/10 hover:bg-white/15 text-white disabled:opacity-50"
      : "border-transparent bg-transparent hover:bg-white/10 text-white/80 disabled:opacity-50";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      {children}
    </button>
  );
}

function Input({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20"
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-black">
          {o.label}
        </option>
      ))}
    </select>
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20"
    />
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
      {children}
    </span>
  );
}

export function OutletHomePage() {
  const nav = useNavigate();

  const [auth, setAuth] = React.useState<AuthPayload | null>(null);
  const [sessions, setSessions] = React.useState<OutletSession[]>([]);
  const [staffSessions, setStaffSessions] = React.useState<OutletSession[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingStaff, setLoadingStaff] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const [category, setCategory] = React.useState("");
  const [visibility, setVisibility] = React.useState<OutletVisibility>("private");

  const isStaff = auth?.role === "admin" || auth?.role === "manager";

  async function loadMe() {
    const me = await apiGet<{ auth: AuthPayload }>("/api/me");
    setAuth(me.auth);
  }

  async function loadMine() {
    setLoading(true);
    setErr(null);
    try {
      const r = await api.outletListMySessions(100);
      setSessions(r.sessions || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }

  async function createSession() {
    setErr(null);
    try {
      const r = await api.outletCreateSession({
        category: category.trim() ? category.trim() : null,
        visibility,
      });
      nav(`/outlet/${r.session.id}`);
    } catch (e: any) {
      setErr(e?.message || "Failed to create session.");
    }
  }

  async function loadStaff() {
    setLoadingStaff(true);
    setErr(null);
    try {
      const r = await api.outletListStaffSessions(200);
      setStaffSessions(r.sessions || []);
    } catch (e: any) {
      setErr(e?.message || "Could not load staff view (need manager/admin).");
      setStaffSessions([]);
    } finally {
      setLoadingStaff(false);
    }
  }

  React.useEffect(() => {
    (async () => {
      try {
        await loadMe();
        await loadMine();
      } catch (e: any) {
        setErr(e?.message || "Failed to load.");
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-emerald-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div>
            <div className="text-xl font-semibold">Counselor’s Office</div>
            <div className="mt-1 text-sm text-white/60">
              Private outlet + AI-guided support. You choose what’s shared.
            </div>
          </div>
          <div className="flex items-center gap-2">
            {auth?.role ? <Pill>Role: {auth.role}</Pill> : null}
            <Button variant="ghost" onClick={() => nav("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          <Card title="Start a new session" subtitle="Pick a category + who can view it.">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <div className="text-xs text-white/60 mb-1">Category</div>
                <Input
                  value={category}
                  onChange={setCategory}
                  placeholder="burnout, scheduling, conflict, pay, safety…"
                />
              </div>

              <div>
                <div className="text-xs text-white/60 mb-1">Visibility</div>
                <Select
                  value={visibility}
                  onChange={(v) => setVisibility(v as OutletVisibility)}
                  options={[
                    { value: "private", label: "Private (AI only)" },
                    { value: "manager", label: "Visible to manager" },
                    { value: "admin", label: "Visible to admin" },
                  ]}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={createSession}>Create</Button>
              <Button variant="ghost" onClick={loadMine} disabled={loading}>
                {loading ? "Refreshing…" : "Refresh"}
              </Button>
              <div className="text-xs text-white/50 self-center">
                Tip: “Private” stays private unless you escalate.
              </div>
            </div>
          </Card>

          <Card
            title="My sessions"
            subtitle={loading ? "Loading…" : `${sessions.length} session(s)`}
          >
            {sessions.length === 0 && !loading ? (
              <div className="text-sm text-white/60">No sessions yet. Create one above.</div>
            ) : null}

            <div className="grid gap-3">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => nav(`/outlet/${s.id}`)}
                  className="text-left rounded-2xl border border-white/10 bg-black/20 p-4 hover:bg-white/5 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{s.category || "General"}</div>
                      <div className="mt-1 text-xs text-white/60">
                        {s.status} • {s.visibility} • updated{" "}
                        {new Date(s.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {s.status === "escalated" ? <Pill>Escalated</Pill> : null}
                      {s.status === "closed" ? <Pill>Closed</Pill> : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {isStaff ? (
            <Card title="Staff view" subtitle="Manager/Admin only. Shows sessions that are visible to your role.">
              <div className="flex flex-wrap gap-2 items-center">
                <Button onClick={loadStaff} disabled={loadingStaff}>
                  {loadingStaff ? "Loading…" : "Load staff sessions"}
                </Button>
                {staffSessions.length ? <Pill>{staffSessions.length} visible</Pill> : null}
              </div>

              {staffSessions.length ? (
                <div className="mt-3 grid gap-2">
                  {staffSessions.map((s) => (
                    <div key={s.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="text-sm font-semibold">{s.category || "General"}</div>
                      <div className="mt-1 text-xs text-white/60">
                        {s.status} • {s.visibility} • sessionId: {s.id}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-sm text-white/60">
                  No staff sessions loaded yet (or none visible).
                </div>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function OutletSessionPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const sessionId = String(id || "");

  const [session, setSession] = React.useState<OutletSession | null>(null);
  const [messages, setMessages] = React.useState<OutletMessage[]>([]);
  const [content, setContent] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await api.outletGetSession(sessionId);
      setSession(r.session);
      setMessages(r.messages || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load session.");
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
      const r = await api.outletSendMessage(sessionId, text);

      // optimistic append
      setMessages((prev) => [...prev, r.userMessage, r.aiMessage].filter(Boolean) as OutletMessage[]);
      setContent("");

      // keep status updated (escalated/closed)
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  async function escalate(to: "manager" | "admin") {
    setErr(null);
    try {
      await api.outletEscalate(sessionId, {
        escalatedToRole: to,
        reason: "Employee requested escalation.",
      });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to escalate.");
    }
  }

  async function close() {
    setErr(null);
    try {
      await api.outletClose(sessionId);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to close.");
    }
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-emerald-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div>
            <div className="text-xl font-semibold">Outlet Session</div>
            {session ? (
              <div className="mt-1 text-sm text-white/60">
                {session.category || "General"} • {session.status} • {session.visibility} • risk {session.riskLevel}
              </div>
            ) : (
              <div className="mt-1 text-sm text-white/60">Session: {sessionId}</div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => nav("/outlet")}>
              Back
            </Button>
            <Button variant="ghost" onClick={() => escalate("manager")}>
              Escalate to Manager
            </Button>
            <Button variant="ghost" onClick={() => escalate("admin")}>
              Escalate to Admin
            </Button>
            <Button onClick={close}>Close</Button>
          </div>
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            Loading…
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          <Card title="Conversation" subtitle="AI replies are stubbed (safe MVP).">
            <div className="max-h-[420px] overflow-auto rounded-2xl border border-white/10 bg-black/20 p-4">
              {messages.length === 0 ? (
                <div className="text-sm text-white/60">No messages yet. Say what’s on your mind.</div>
              ) : null}

              <div className="grid gap-4">
                {messages.map((m) => (
                  <div key={m.id}>
                    <div className="text-xs text-white/50">
                      <b className="text-white/80">{m.sender === "ai" ? "AI" : "You"}</b>{" "}
                      • {new Date(m.createdAt).toLocaleString()}
                    </div>
                    <div className="mt-1 text-sm whitespace-pre-wrap">{m.content}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 grid gap-2">
              <TextArea
                value={content}
                onChange={setContent}
                placeholder="Type your message…"
                rows={4}
              />
              <div className="flex gap-2">
                <Button onClick={send} disabled={sending || !content.trim()}>
                  {sending ? "Sending…" : "Send"}
                </Button>
                <Button variant="ghost" onClick={load} disabled={loading || sending}>
                  Refresh
                </Button>
              </div>

              <div className="text-xs text-white/50">
                If this is an immediate safety issue, contact local emergency services or your company’s emergency process.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
