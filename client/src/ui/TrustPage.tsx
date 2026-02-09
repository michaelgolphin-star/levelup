// client/src/ui/TrustPage.tsx (NEW FILE)

import React from "react";
import { Link } from "react-router-dom";

const DOCTRINE =
  "This app exists to connect organizations and employees empathetically, while giving organizations responsible visibility into patterns that affect wellbeing, retention, and safety — without violating individual dignity.";

export default function TrustPage() {
  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Trust & Visibility</h1>
            <div className="sub">Clear rules, plain language, no surprises.</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn" to="/dashboard">
              Dashboard
            </Link>
            <Link className="btn" to="/outlet">
              Counselor’s Office
            </Link>
          </div>
        </div>

        <div className="body">
          <div className="panel">
            <div className="panelTitle">Doctrine (locked)</div>
            <div style={{ marginTop: 12, lineHeight: 1.6, fontSize: 16 }}>{DOCTRINE}</div>
          </div>

          <div className="grid2" style={{ marginTop: 14 }}>
            <div className="panel">
              <div className="panelTitle">What your organization can see</div>
              <div className="small" style={{ marginTop: 10, lineHeight: 1.6 }}>
                <div>
                  • <b>Aggregated trends</b> (ex: org mood/stress averages by day)
                </div>
                <div>
                  • <b>Risk flags based on patterns</b> (ex: repeated high stress, repeated low mood)
                </div>
                <div>
                  • <b>Visibility-controlled Counselor’s Office sessions</b> (only when you choose manager/admin visibility,
                  or escalation occurs)
                </div>
                <div>
                  • <b>Staff notes</b> (manager/admin only — intended for support + follow-through)
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panelTitle">What your organization cannot see</div>
              <div className="small" style={{ marginTop: 10, lineHeight: 1.6 }}>
                <div>
                  • <b>Your private Counselor’s Office sessions</b> unless you set visibility to manager/admin
                </div>
                <div>
                  • <b>Your login password</b> (it’s hashed; nobody can “read” it)
                </div>
                <div>
                  • <b>Anything outside your organization</b> (org boundary is enforced server-side)
                </div>
                <div>
                  • <b>Private journaling content</b> (if you add Confessional later, it stays user-only unless you explicitly share)
                </div>
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 14 }}>
            <div className="panelTitle">How Counselor’s Office visibility works</div>
            <div className="small" style={{ marginTop: 10, lineHeight: 1.6 }}>
              <div>
                • <b>private</b>: only you can view
              </div>
              <div>
                • <b>manager</b>: managers (and admins) can view
              </div>
              <div>
                • <b>admin</b>: admins can view
              </div>
              <div style={{ marginTop: 10 }}>
                Escalation changes the session state and is logged — the goal is <b>support + safety</b>, not punishment.
              </div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 14 }}>
            <div className="panelTitle">Dignity rules (non-negotiable)</div>
            <div className="small" style={{ marginTop: 10, lineHeight: 1.6 }}>
              <div>
                • This system is designed for <b>patterns</b>, not “gotchas.”
              </div>
              <div>
                • Visibility is <b>role-based</b> and <b>org-scoped</b>.
              </div>
              <div>
                • The purpose is <b>retention, wellbeing, and safety</b> — with respectful boundaries.
              </div>
              <div>
                • If you ever feel uncertain, come here — the rules stay the same.
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn" to="/dashboard">
              Back to Dashboard
            </Link>
            <Link className="btn" to="/outlet">
              Open Counselor’s Office
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
