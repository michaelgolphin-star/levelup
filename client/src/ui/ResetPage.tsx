import React from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export default function ResetPage() {
  const [username, setUsername] = React.useState("");
  const [token, setToken] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function request(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setLoading(true);
    try {
      const resp = await api.requestPasswordReset(username);
      setToken(resp.reset.token);
      setMsg("Reset token generated. Paste it below to set a new password.");
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null); setLoading(true);
    try {
      await api.resetPassword(token, newPassword);
      setMsg("Password updated ✅ You can log in now.");
    } catch (e: any) {
      setErr(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Reset password</h1>
            <div className="sub">Demo flow: generates a token on-screen.</div>
          </div>
          <span className="badge">Access</span>
        </div>
        <div className="body">
          <form onSubmit={request} className="row" style={{ alignItems: "flex-end" }}>
            <div className="col">
              <div className="label">Username</div>
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
            </div>
            <div className="col" style={{ flexBasis: 200 }}>
              <button className="btn primary" disabled={loading}>Generate token</button>
            </div>
          </form>

          <hr />

          <form onSubmit={apply} className="row" style={{ alignItems: "flex-end" }}>
            <div className="col">
              <div className="label">Reset token</div>
              <input className="input" value={token} onChange={(e) => setToken(e.target.value)} />
            </div>
            <div className="col">
              <div className="label">New password</div>
              <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="col" style={{ flexBasis: 200 }}>
              <button className="btn primary" disabled={loading}>Set new password</button>
            </div>
          </form>

          {msg && <div className="small" style={{ marginTop: 10, color: "#34d399" }}>{msg}</div>}
          {err && <div className="small" style={{ marginTop: 10, color: "#fb7185" }}>{err}</div>}

          <hr />
          <div className="small"><Link to="/login">Back to login</Link></div>
        </div>
      </div>
    </div>
  );
}
