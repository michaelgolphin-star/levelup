// client/src/ui/LandingPage.tsx (FULL REPLACEMENT)

import React from "react";
import { Link } from "react-router-dom";

const DOCTRINE =
  "This app exists to connect organizations and employees empathetically, while giving organizations responsible visibility into patterns that affect wellbeing, retention, and safety — without violating individual dignity.";

export default function LandingPage() {
  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Level Up</h1>
            <div className="sub">Empathy + operational clarity — with dignity.</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn" to="/login">
              Login
            </Link>
            <Link className="btn primary" to="/register">
              Create org
            </Link>
          </div>
        </div>

        <div className="body">
          <div className="panel">
            <div className="panelTitle">Why this exists</div>
            <div style={{ marginTop: 12, lineHeight: 1.6, fontSize: 16 }}>{DOCTRINE}</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
              <Link className="btn" to="/trust">
                How visibility works
              </Link>
              <Link className="btn" to="/register">
                Start an org
              </Link>
              <Link className="btn" to="/login">
                Join / sign in
              </Link>
            </div>

            <div className="small" style={{ marginTop: 10, lineHeight: 1.6 }}>
              Trust loop: you can always review what’s visible, to whom, and why — inside the app.
            </div>
          </div>

          <div className="grid2" style={{ marginTop: 14 }}>
            <div className="panel">
              <div className="panelTitle">For employees</div>
              <div className="small" style={{ marginTop: 10, lineHeight: 1.6 }}>
                • Daily check-ins (mood/energy/stress) <br />
                • A private outlet with optional escalation <br />
                • Lightweight habit tracking <br />
                • Control over what’s shared
              </div>
            </div>

            <div className="panel">
              <div className="panelTitle">For organizations</div>
              <div className="small" style={{ marginTop: 10, lineHeight: 1.6 }}>
                • Trend dashboards (aggregated patterns) <br />
                • Early risk signals (retention/safety) <br />
                • Role-based staff access <br />
                • Documentation that supports follow-through
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
