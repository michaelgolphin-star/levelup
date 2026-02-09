// client/src/ui/OutletInboxPage.tsx (FULL REPLACEMENT)
// ✅ Default export (fixes your build error)
// ✅ User Inbox: list + mark read + acknowledge
// ✅ Staff (admin/manager): Sent tab w/ stats + composer (send new inbox message)

import React, { useEffect, useMemo, useState } from "react";

type Role = "user" | "manager" | "admin";

type AuthPayload = {
  userId: string;
  orgId: string;
  role: Role;
};

type InboxReceiptStatus = "unread" | "read" | "acked";
type InboxSeverity = "info" | "warning" | "critical";
type InboxAudienceRole = "all" | "user" | "manager" | "admin";

type InboxItem = {
  id: string;
  orgId: string;
  createdBy: string;
  audienceRole: InboxAudienceRole;
  audienceUserId: string | null;
  severity: InboxSeverity;
  title: string;
  body: string;
  tags: string[];
  tagsJson: string;
  requiresAck: boolean;
  createdAt: string;
  receipt: {
    id: string;
    userId: string;
    status: InboxReceiptStatus;
    readAt: string | null;
    ackAt: string | null;
    updatedAt: string;
    createdAt: string;
  };
};

type SentItem = {
  message: {
    id: string;
    orgId: string;
    createdBy: string;
    audienceRole: InboxAudienceRole;
    audienceUserId: string | null;
    severity: InboxSeverity;
    title: string;
    body: string;
    tags: string[];
    tagsJson: string;
    requiresAck: boolean;
    createdAt: string;
  };
  stats: {
    recipientsTotal: number;
    readTotal: number;
    ackedTotal: number;
  };
};

function getToken() {
  return localStorage.getItem("token") || "";
}

async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(opts.headers as any),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...opts, headers });
  const text = await res.text();
  const json = text ? (() => { try { return JSON.parse(text); } catch { return { raw: text }; } })() : {};

  if (!res.ok) {
    const msg =
      (json && (json.error?.message || json.error || json.message)) ||
      `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : "Request failed");
  }

  return json as T;
}

function fmt(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString();
}

function pillStyle(kind: "neutral" | "info" | "warning" | "critical") {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "2px 10px",
    borderRadius: 999,
    fontSize: 12,
    border: "1px solid var(--border, rgba(0,0,0,.15))",
  };
  if (kind === "warning") return { ...base, background: "rgba(255,200,0,.12)" };
  if (kind === "critical") return { ...base, background: "rgba(255,0,0,.10)" };
  if (kind === "info") return { ...base, background: "rgba(0,120,255,.10)" };
  return { ...base, background: "rgba(0,0,0,.04)" };
}

export default function OutletInboxPage() {
  const [auth, setAuth] = useState<AuthPayload | null>(null);

  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const isStaff = auth?.role === "admin" || auth?.role === "manager";

  // Inbox data
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);

  // Sent data
  const [sent, setSent] = useState<SentItem[]>([]);
  const [loadingSent, setLoadingSent] = useState(false);

  // Errors / banners
  const [err, setErr] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // Compose (staff)
  const [composeOpen, setComposeOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<InboxSeverity>("info");
  const [audienceRole, setAudienceRole] = useState<InboxAudienceRole>("all");
  const [audienceUserId, setAudienceUserId] = useState<string>("");
  const [requiresAck, setRequiresAck] = useState(false);
  const [tags, setTags] = useState<string>("");

  const unreadCount = useMemo(
    () => items.filter((x) => x.receipt?.status === "unread").length,
    [items],
  );

  async function loadAuth() {
    try {
      const me = await api<{ auth: AuthPayload }>("/api/me");
      setAuth(me.auth);
    } catch (e: any) {
      setAuth(null);
      setErr(e?.message || "Could not load session. Please log in again.");
    }
  }

  async function loadInbox() {
    setLoadingInbox(true);
    setErr(null);
    try {
      const data = await api<{ items: InboxItem[] }>("/api/inbox?limit=100");
      setItems(data.items || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load inbox.");
    } finally {
      setLoadingInbox(false);
    }
  }

  async function loadSent() {
    if (!isStaff) return;
    setLoadingSent(true);
    setErr(null);
    try {
      const data = await api<{ sent: SentItem[] }>("/api/staff/inbox/messages?limit=50&sinceDays=30");
      setSent(data.sent || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load sent messages.");
    } finally {
      setLoadingSent(false);
    }
  }

  useEffect(() => {
    loadAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!auth) return;
    loadInbox();
    if (isStaff) loadSent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.userId]);

  useEffect(() => {
    if (!isStaff && tab === "sent") setTab("inbox");
  }, [isStaff, tab]);

  async function markRead(messageId: string) {
    setErr(null);
    try {
      await api(`/api/inbox/${messageId}/read`, { method: "POST" });
      setItems((prev) =>
        prev.map((it) =>
          it.id === messageId
            ? {
                ...it,
                receipt: {
                  ...it.receipt,
                  status: it.receipt.status === "unread" ? "read" : it.receipt.status,
                  readAt: it.receipt.readAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              }
            : it,
        ),
      );
    } catch (e: any) {
      setErr(e?.message || "Failed to mark read.");
    }
  }

  async function ack(messageId: string) {
    setErr(null);
    try {
      await api(`/api/inbox/${messageId}/ack`, { method: "POST" });
      setItems((prev) =>
        prev.map((it) =>
          it.id === messageId
            ? {
                ...it,
                receipt: {
                  ...it.receipt,
                  status: "acked",
                  readAt: it.receipt.readAt || new Date().toISOString(),
                  ackAt: it.receipt.ackAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              }
            : it,
        ),
      );
    } catch (e: any) {
      setErr(e?.message || "Failed to acknowledge.");
    }
  }

  async function sendMessage() {
    setErr(null);
    setBanner(null);

    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      setErr("Title and body are required.");
      return;
    }

    const tagsArr = tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);

    try {
      await api("/api/staff/inbox/messages", {
        method: "POST",
        body: JSON.stringify({
          title: t,
          body: b,
          severity,
          tags: tagsArr,
          requiresAck,
          audienceRole,
          audienceUserId: audienceUserId.trim() ? audienceUserId.trim() : null,
        }),
      });

      setBanner("Sent ✅");
      setComposeOpen(false);

      // reset form
      setTitle("");
      setBody("");
      setSeverity("info");
      setAudienceRole("all");
      setAudienceUserId("");
      setRequiresAck(false);
      setTags("");

      // refresh sent list
      await loadSent();
    } catch (e: any) {
      setErr(e?.message || "Failed to send message.");
    }
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Inbox</h2>
          <div style={{ opacity: 0.75, fontSize: 13, marginTop: 4 }}>
            Trust loop: delivery → read → acknowledge (auditable).
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={pillStyle(unreadCount ? "warning" : "neutral")}>
            Unread: <strong>{unreadCount}</strong>
          </span>
          <button
            onClick={() => {
              setBanner(null);
              loadInbox();
              if (isStaff) loadSent();
            }}
            style={{ padding: "8px 10px", borderRadius: 10 }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => setTab("inbox")}
          style={{
            padding: "8px 12px",
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,.15)",
            background: tab === "inbox" ? "rgba(0,0,0,.06)" : "transparent",
          }}
        >
          My Inbox
        </button>

        {isStaff && (
          <button
            onClick={() => setTab("sent")}
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,.15)",
              background: tab === "sent" ? "rgba(0,0,0,.06)" : "transparent",
            }}
          >
            Sent (Staff)
          </button>
        )}

        {isStaff && (
          <div style={{ marginLeft: "auto" }}>
            <button
              onClick={() => setComposeOpen((v) => !v)}
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,.15)",
              }}
            >
              {composeOpen ? "Close Composer" : "New Message"}
            </button>
          </div>
        )}
      </div>

      {banner && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 12,
            background: "rgba(0,120,255,.10)",
            border: "1px solid rgba(0,120,255,.18)",
          }}
        >
          {banner}
        </div>
      )}

      {err && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 12,
            background: "rgba(255,0,0,.08)",
            border: "1px solid rgba(255,0,0,.15)",
          }}
        >
          {err}
        </div>
      )}

      {isStaff && composeOpen && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,.15)",
            background: "rgba(0,0,0,.02)",
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 240px" }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Title</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short headline"
                style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,.15)" }}
              />
            </div>

            <div style={{ width: 160 }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Severity</div>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as InboxSeverity)}
                style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,.15)" }}
              >
                <option value="info">info</option>
                <option value="warning">warning</option>
                <option value="critical">critical</option>
              </select>
            </div>

            <div style={{ width: 180 }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Audience Role</div>
              <select
                value={audienceRole}
                onChange={(e) => setAudienceRole(e.target.value as InboxAudienceRole)}
                style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,.15)" }}
              >
                <option value="all">all</option>
                <option value="user">user</option>
                <option value="manager">manager</option>
                <option value="admin">admin</option>
              </select>
            </div>

            <div style={{ width: 220 }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Direct User ID (optional)</div>
              <input
                value={audienceUserId}
                onChange={(e) => setAudienceUserId(e.target.value)}
                placeholder="Paste userId to target 1 person"
                style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,.15)" }}
              />
            </div>

            <div style={{ flex: "1 1 240px" }}>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Tags (comma separated)</div>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="policy, schedule, safety"
                style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,.15)" }}
              />
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Body</div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the message employees will receive..."
              rows={5}
              style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid rgba(0,0,0,.15)" }}
            />
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
              <input checked={requiresAck} onChange={(e) => setRequiresAck(e.target.checked)} type="checkbox" />
              Requires acknowledgement
            </label>

            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  setComposeOpen(false);
                }}
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,.15)" }}
              >
                Cancel
              </button>

              <button
                onClick={sendMessage}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,.15)",
                  background: "rgba(0,120,255,.12)",
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ marginTop: 14 }}>
        {tab === "inbox" ? (
          <div>
            {loadingInbox ? (
              <div style={{ opacity: 0.75 }}>Loading inbox…</div>
            ) : items.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No messages yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {items.map((it) => {
                  const status = it.receipt?.status || "unread";
                  const sev = it.severity || "info";
                  const needsAck = !!it.requiresAck;

                  return (
                    <div
                      key={it.id}
                      style={{
                        border: "1px solid rgba(0,0,0,.15)",
                        borderRadius: 16,
                        padding: 14,
                        background: status === "unread" ? "rgba(255,200,0,.06)" : "transparent",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={pillStyle(sev === "critical" ? "critical" : sev === "warning" ? "warning" : "info")}>
                              {sev.toUpperCase()}
                            </span>
                            <span style={pillStyle(status === "unread" ? "warning" : status === "acked" ? "info" : "neutral")}>
                              {status.toUpperCase()}
                            </span>
                            {needsAck && <span style={pillStyle("neutral")}>ACK REQUIRED</span>}
                          </div>

                          <div style={{ fontWeight: 700, fontSize: 16 }}>{it.title}</div>

                          <div style={{ opacity: 0.75, fontSize: 12 }}>
                            Sent: {fmt(it.createdAt)}
                            {it.receipt?.readAt ? ` • Read: ${fmt(it.receipt.readAt)}` : ""}
                            {it.receipt?.ackAt ? ` • Ack: ${fmt(it.receipt.ackAt)}` : ""}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {status === "unread" && (
                            <button
                              onClick={() => markRead(it.id)}
                              style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,.15)" }}
                            >
                              Mark Read
                            </button>
                          )}

                          {(needsAck || status !== "acked") && (
                            <button
                              onClick={() => ack(it.id)}
                              style={{
                                padding: "10px 12px",
                                borderRadius: 12,
                                border: "1px solid rgba(0,0,0,.15)",
                                background: needsAck ? "rgba(0,120,255,.12)" : "transparent",
                              }}
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
                      </div>

                      <div style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.35 }}>{it.body}</div>

                      {it.tags?.length ? (
                        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {it.tags.map((t) => (
                            <span key={t} style={pillStyle("neutral")}>
                              #{t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            {!isStaff ? (
              <div style={{ opacity: 0.75 }}>Staff view not available.</div>
            ) : loadingSent ? (
              <div style={{ opacity: 0.75 }}>Loading sent…</div>
            ) : sent.length === 0 ? (
              <div style={{ opacity: 0.75 }}>No sent messages yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {sent.map((s) => {
                  const m = s.message;
                  const st = s.stats;
                  return (
                    <div
                      key={m.id}
                      style={{
                        border: "1px solid rgba(0,0,0,.15)",
                        borderRadius: 16,
                        padding: 14,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={pillStyle(m.severity === "critical" ? "critical" : m.severity === "warning" ? "warning" : "info")}>
                              {m.severity.toUpperCase()}
                            </span>
                            <span style={pillStyle("neutral")}>
                              Audience:{" "}
                              <strong>
                                {m.audienceUserId ? "DIRECT" : m.audienceRole.toUpperCase()}
                              </strong>
                            </span>
                            {m.requiresAck && <span style={pillStyle("neutral")}>ACK REQUIRED</span>}
                          </div>

                          <div style={{ fontWeight: 700, fontSize: 16 }}>{m.title}</div>

                          <div style={{ opacity: 0.75, fontSize: 12 }}>
                            Sent: {fmt(m.createdAt)} • Recipients: {st.recipientsTotal} • Read: {st.readTotal} • Acked:{" "}
                            {st.ackedTotal}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button
                            onClick={loadSent}
                            style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,.15)" }}
                          >
                            Refresh Sent
                          </button>
                        </div>
                      </div>

                      <div style={{ marginTop: 10, whiteSpace: "pre-wrap", lineHeight: 1.35 }}>{m.body}</div>

                      {m.tags?.length ? (
                        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {m.tags.map((t) => (
                            <span key={t} style={pillStyle("neutral")}>
                              #{t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div style={{ marginTop: 18, opacity: 0.7, fontSize: 12 }}>
        Tip: If “Acknowledge” is required, you’re creating a clean, respectful audit trail (read/ack timestamps) without
        exposing private journaling content.
      </div>
    </div>
  );
}
