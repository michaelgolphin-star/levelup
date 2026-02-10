// client/src/ui/VisibilityPage.tsx (NEW FILE)

import React from "react";
import { Link } from "react-router-dom";

export default function VisibilityPage() {
  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Responsible Visibility</h1>
            <div className="sub">How this app protects dignity while still surfacing patterns.</div>
          </div>
          <Link className="btn" to="/dashboard">
            Back to Dashboard
          </Link>
        </div>

        <div className="body">
          <div className="panel">
            <div className="panelTitle">
              <span>What staff can see</span>
              <span className="badge">Patterns, not your soul</span>
            </div>

            <div className="small" style={{ marginTop: 10, lineHeight: 1.7 }}>
              <b>1) Your check-ins are yours first.</b> They exist to help you self-track, build consistency, and ask for
              help when you choose.
              <br />
              <br />
              <b>2) Visibility is consent-based.</b> In the Counselor’s Office, you control visibility per session:
              <b> private</b>, <b>manager</b>, or <b>admin</b>.
              <br />
              <br />
              <b>3) Staff view is rule-based.</b> Staff can only view sessions when visibility permits — and escalation is
              explicit.
              <br />
              <br />
              <b>4) The system focuses on trends.</b> Org analytics show patterns that affect wellbeing, retention, and
              safety — without trying to “judge” someone’s character.
              <br />
              <br />
              <b>5) The point is support, not punishment.</b> If something is escalated, it should result in help,
              clarification, protection, or a documented resolution — not humiliation.
            </div>
          </div>

          <div className="panel" style={{ marginTop: 12 }}>
            <div className="panelTitle">
              <span>The Trust Loop</span>
              <span className="badge good">Core doctrine</span>
            </div>

            <div className="small" style={{ marginTop: 10, lineHeight: 1.7 }}>
              <b>Employee →</b> expresses & documents privately <br />
              <b>System →</b> reflects & organizes without looping <br />
              <b>Employee →</b> chooses escalation or closure <br />
              <b>Org →</b> sees only what’s permitted + acts responsibly <br />
              <b>Outcome →</b> resolution + retention + safety, while preserving dignity
            </div>

            <div className="small" style={{ marginTop: 10 }}>
              Short version: <b>privacy by default</b>, <b>visibility by choice</b>, <b>patterns for safety</b>,{" "}
              <b>human dignity always</b>.
            </div>
          </div>

          <div className="small" style={{ marginTop: 12 }}>
            Links:{" "}
            <Link to="/outlet" style={{ marginRight: 10 }}>
              Counselor’s Office
            </Link>
            <Link to="/outlet-inbox">Inbox</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
