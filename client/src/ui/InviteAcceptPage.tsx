import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, setToken } from "../lib/api";

export default function InviteAcceptPage() {
  const { token } = useParams();
  const nav = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [orgName, setOrgName] = React.useState<string>("");
  const [role, setRole] = React.useState<string>("");
  const [expiresAt, setExpiresAt] = React.useState<string>("");
  const [err, setErr] = React.useState<string | null>(null);

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    async function load() {
      setErr(null);
      setLoading(true);
      try {
        if (!token) throw new Error("Missing invite token");
        const resp = await api.getInvite(token);
        if (!alive) return;
        setOrgName(resp.org?.name || "");
        setRole(resp.invite?.role || "");
        setExpiresAt(resp.invite?.expiresAt || "");
      } catch (e: any) {
        setErr(e.message || "Invite not valid");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [token]);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      if (!token) throw new Error("Missing token");
      const resp = await api.acceptInvite(token, { username, password });
      setToken(resp.token);
      nav("/dashboard");
    } catch (e: any) {
      setErr(e.message || "Failed to accept invite");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Join {orgName || "program"}</h1>
            <div className="sub">You’re about to join as <b>{role || "user"}</b>.</div>
          </div>
          <span className="badge">Invite</span>
        </div>
        <div className="body">
          {loading ? (
            <div className="small">Loading invite…</div>
          ) : err ? (
            <div className="small" style={{ color: "#fb7185" }}>{err}</div>
          ) : (
            <>
              <div className="small">Expires: {new Date(expiresAt).toLocaleString()}</div>
              <hr />
              <form onSubmit={accept} className="row" style={{ alignItems: "flex-end" }}>
                <div className="col">
                  <div className="label">Choose a username</div>
                  <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" />
                </div>
                <div className="col">
                  <div className="label">Create a password</div>
                  <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div className="col" style={{ flexBasis: 200 }}>
                  <button className="btn primary" disabled={submitting}>
                    {submitting ? "Joining..." : "Join and continue"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
