// client/src/ui/OutletPage.tsx (FULL REPLACEMENT)

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AuthPayload, Role } from "../lib/api";
import { api, apiGet } from "../lib/api";

type OutletVisibility = "private" | "manager" | "admin";
type OutletStatus = "open" | "escalated" | "closed" | "resolved";

function visLabel(v: OutletVisibility) {
  if (v === "admin") return "Admin only";
  if (v === "manager") return "Manager + Admin";
  return "Only you";
}

function statusLabel(s: OutletStatus) {
  if (s === "resolved") return "Resolved";
  if (s === "closed") return "Closed";
  if (s === "escalated") return "Escalated";
  return "Open";
}

function riskBadge(riskLevel: number) {
  if (riskLevel >= 2) return { cls: "badge bad", label: "High risk" };
  if (riskLevel === 1) return { cls: "badge warn", label: "Elevated" };
  return { cls: "badge good", label: "Normal" };
}

export function OutletHomePage() {
  const nav = useNavigate();
  const [auth, setAuth] = useState<AuthPayload | null>(null);

  async function loadAuth() {
    const me = await apiGet<{ auth: AuthPayload }>("/api/me");
    setAuth(me.auth);
  }

  useEffect(() => {
    loadAuth().catch(() => nav("/login"));
  }, []);

  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Counselor’s Office</h1>
            <div className="sub">
              A private space to think, document, and escalate — on your terms.
            </div>
          </div>
          <Link className="btn primary" to="/dashboard">
            Back to dashboard
          </Link>
        </div>

        <div className="body">
          <button
            className="btn primary"
            onClick={async () => {
              const r = await api.outletCreateSession({ visibility: "private" });
              nav(`/outlet/${r.session.id}`);
            }}
          >
            Start a new session
          </button>
        </div>
      </div>
    </div>
  );
}

export function OutletSessionPage() {
  const nav = useNavigate();
  const { id } = useParams();

  const [auth, setAuth] = useState<AuthPayload | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  async function loadAll() {
    const me = await apiGet<{ auth: AuthPayload }>("/api/me");
    setAuth(me.auth);

    const r = await api.outletGetSession(id!);
    setSession(r.session);
    setMessages(r.messages || []);
  }

  useEffect(() => {
    loadAll().catch(() => nav("/outlet"));
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (loading && !session) {
    return <div className="container"><div className="card body">Loading…</div></div>;
  }

  const rb = riskBadge(Number(session?.riskLevel || 0));
  const st: OutletStatus = session.status;

  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Counselor’s Office</h1>
            <div className="sub">
              {session.category || "General"} • {statusLabel(st)}
            </div>
          </div>
          <Link className="btn" to="/outlet">Back</Link>
        </div>

        <div className="body grid2">
          {/* LEFT: Conversation */}
          <div className="panel">
            <div className="panelTitle">
              <span>Conversation</span>
              <span className={rb.cls}>{rb.label}</span>
            </div>

            <div className="chatBox">
              {messages.map((m) => (
                <div key={m.id} className={`bubble ${m.sender === "user" ? "user" : "ai"}`}>
                  <div className="bubbleText">{m.content}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {st === "open" && (
              <div style={{ marginTop: 12 }}>
                <textarea
                  ref={inputRef}
                  className="textarea"
                  rows={3}
                  placeholder="Type what’s on your mind…"
                />
              </div>
            )}
          </div>

          {/* RIGHT: Trust & Visibility */}
          <div className="panel">
            <div className="panelTitle">
              <span>Visibility & trust</span>
              <span className="badge">{visLabel(session.visibility)}</span>
            </div>

            <div className="small" style={{ marginTop: 8 }}>
              This session is currently visible to:
            </div>

            <ul className="small" style={{ marginTop: 6 }}>
              {session.visibility === "private" && <li>• Only you</li>}
              {session.visibility === "manager" && (
                <>
                  <li>• You</li>
                  <li>• Managers</li>
                  <li>• Admins</li>
                </>
              )}
              {session.visibility === "admin" && (
                <>
                  <li>• You</li>
                  <li>• Admins</li>
                </>
              )}
            </ul>

            <hr />

            <div className="small">
              Visibility changes only if:
            </div>

            <ul className="small" style={{ marginTop: 6 }}>
              <li>• You choose to escalate</li>
              <li>• Safety keywords trigger an admin alert</li>
              <li>• A staff member resolves or closes the session</li>
            </ul>

            <div className="small" style={{ marginTop: 10, opacity: 0.8 }}>
              You can always review what’s visible, to whom, and why.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
