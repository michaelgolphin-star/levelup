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

  const title = mode === "register" ? "Start your program" : "Welcome back";
  const subtitle =
    mode === "register"
      ? "Create a space for consistency, accountability, and growth."
      : "Log in and keep building momentum.";

  return (
    <div className="authWrap">
      <div className="authCard">
        <div className="authGrid">
          {/* Left / hero */}
          <div className="authLeft">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div className="authHeroTitle">{title}</div>
                <div className="authHeroSub">{subtitle}</div>
              </div>
              <span className="badge">{mode === "register" ? "Admin setup" : "Access"}</span>
            </div>

            <div style={{ marginTop: 16 }} className="small">
              This app exists to connect organizations and employees empathetically, while giving organizations
              responsible visibility into patterns that affect wellbeing, retention, and safety — without violating
              individual dignity.
            </div>

            <div style={{ marginTop: 14, opacity: 0.9 }} className="small">
              Tip: Use simple usernames (letters/numbers/dots/underscores). Passwords are hashed + stored securely.
            </div>
          </div>

          {/* Right / form */}
          <div className="authRight">
            <form onSubmit={submit} className="authForm">
              {mode === "register" ? (
                <div style={{ marginBottom: 12 }}>
                  <div className="label">Program / Organization name</div>
                  <input
                    className="input"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g., Level Up Program"
                  />
                </div>
              ) : null}

              <div style={{ marginBottom: 12 }}>
                <div className="label">Username</div>
                <input
                  className="input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="yourname"
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <div className="label">Password</div>
                <input
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                />
              </div>

              <div className="authActions">
                <button className="btn primary" disabled={loading || !username.trim() || !password}>
                  {loading ? "Working..." : mode === "register" ? "Create space" : "Log in"}
                </button>

                <Link className="btn" to="/">
                  Home
                </Link>
              </div>

              {err ? <div className="toast bad" style={{ marginTop: 12 }}>{err}</div> : null}

              <hr style={{ marginTop: 16 }} />

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
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
