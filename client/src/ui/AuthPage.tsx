// client/src/ui/AuthPage.tsx (FULL REPLACEMENT)

import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setToken } from "../lib/api";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const nav = useNavigate();
  const [orgName, setOrgName] = React.useState("Level Up Program");
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const resp =
        mode === "register"
          ? await api.register(orgName, username, password)
          : await api.login(username, password);

      setToken(resp.token);
      nav("/dashboard");
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>{mode === "register" ? "Start your program" : "Welcome back"}</h1>
            <div className="sub">
              {mode === "register"
                ? "Create a space for consistency, accountability, and growth."
                : "Log in and keep building momentum."}
            </div>
          </div>
          <span className="badge">{mode === "register" ? "Admin setup" : "Access"}</span>
        </div>

        <div className="body">
          <form onSubmit={submit} className="row" style={{ alignItems: "flex-end" }}>
            {mode === "register" && (
              <div className="col">
                <div className="label">Program / Organization name</div>
                <input
                  className="input"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                />
              </div>
            )}

            <div className="col">
              <div className="label">Username</div>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            <div className="col">
              <div className="label">Password</div>
              <input
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
              />
            </div>

            <div className="col" style={{ flexBasis: 180 }}>
              <button className="btn primary" disabled={loading || !username.trim() || !password}>
                {loading ? "Working..." : mode === "register" ? "Create space" : "Log in"}
              </button>
            </div>
          </form>

          {err && (
            <div style={{ marginTop: 12 }} className="card body">
              <div style={{ color: "#fb7185", fontWeight: 700 }}>Error</div>
              <div className="small">{err}</div>
            </div>
          )}

          <hr />

          <div className="small">
            {mode === "register" ? (
              <>
                Already part of a program? <Link to="/login">Log in</Link>
              </>
            ) : (
              <>
                New here? <Link to="/register">Create a program</Link>
              </>
            )}
          </div>

          <div className="small" style={{ marginTop: 10 }}>
            Forgot password? <Link to="/reset">Reset it</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
