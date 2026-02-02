import React from "react";
import { Link } from "react-router-dom";
import { getToken } from "../lib/api";

export default function LandingPage() {
  const token = getToken();
  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Level Up</h1>
            <div className="sub">Structure for real life — built for people and programs.</div>
          </div>
          <span className="badge">Consistency > motivation</span>
        </div>
        <div className="body">
          <div className="row">
            <div className="col">
              <div className="kpi">
                <div className="small">1) Check in</div>
                <div className="num">60s</div>
                <div className="small">Mood, energy, stress, notes — as many times as you need.</div>
              </div>
            </div>
            <div className="col">
              <div className="kpi">
                <div className="small">2) Track habits</div>
                <div className="num">Weekly</div>
                <div className="small">Set targets that are honest and doable.</div>
              </div>
            </div>
            <div className="col">
              <div className="kpi">
                <div className="small">3) Learn patterns</div>
                <div className="num">Simple</div>
                <div className="small">Streaks + averages. No judgment. Just signal.</div>
              </div>
            </div>
          </div>
          <hr />
          <div className="row">
            <div className="col">
              <h3 style={{ marginTop: 0 }}>For individuals</h3>
              <div className="small">Rebuild momentum, self-trust, and clarity—one day at a time.</div>
            </div>
            <div className="col">
              <h3 style={{ marginTop: 0 }}>For programs</h3>
              <div className="small">Track engagement trends across a cohort with lightweight analytics.</div>
            </div>
          </div>
          <hr />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {token ? (
              <Link className="btn primary" to="/dashboard">Go to dashboard</Link>
            ) : (
              <>
                <Link className="btn primary" to="/register">Create a program</Link>
                <Link className="btn" to="/login">Log in</Link>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="small" style={{ marginTop: 12 }}>
        Built to stay boring, reliable, and honest.
      </div>
    </div>
  );
}
