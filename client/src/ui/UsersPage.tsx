// client/src/ui/UsersPage.tsx (NEW)
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

type Role = "user" | "manager" | "admin";

export default function UsersPage() {
  const nav = useNavigate();

  const [err, setErr] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("user");

  const [seedRole, setSeedRole] = useState<"user" | "manager">("user");
  const [seeded, setSeeded] = useState<{ username: string; password: string; user: any } | null>(null);

  async function load() {
    setErr(null);
    try {
      const r = await api.listUsers();
      setUsers(r.users || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load users");
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await api.me(); // auth check
        await load();
      } catch {
        nav("/login");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(() => {
    return [...users].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [users]);

  async function createUser() {
    setErr(null);
    try {
      const u = newUsername.trim();
      const p = newPassword;
      if (!u || !p) {
        setErr("Username and password required");
        return;
      }
      await api.adminCreateUser({ username: u, password: p, role: newRole });
      setNewUsername("");
      setNewPassword("");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to create user");
    }
  }

  async function changeRole(userId: string, role: Role) {
    setErr(null);
    try {
      await api.setUserRole(userId, role);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to set role");
    }
  }

  async function seedDemo() {
    setErr(null);
    try {
      const r = await api.adminSeedDemoUser(seedRole);
      setSeeded({
        username: r.seeded.credentials.username,
        password: r.seeded.credentials.password,
        user: r.seeded.user,
      });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to seed demo user");
    }
  }

  async function loginAsSeeded() {
    if (!seeded) return;
    setErr(null);
    try {
      await api.login(seeded.username, seeded.password);
      nav("/dashboard");
    } catch (e: any) {
      setErr(e?.message || "Failed to login as seeded user");
    }
  }

  async function copySeeded() {
    if (!seeded) return;
    const text = `username: ${seeded.username}\npassword: ${seeded.password}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div className="hdr">
          <div>
            <h1>Users</h1>
            <div className="sub">Create employees, promote managers, and quickly switch accounts.</div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link className="btn" to="/dashboard">
              ← Dashboard
            </Link>
            <button className="btn" onClick={load}>
              Refresh
            </button>
          </div>
        </div>

        <div className="body">
          {err ? <div className="toast bad">{err}</div> : null}

          <div className="grid2">
            <div className="panel">
              <div className="panelTitle">
                <span>Create user</span>
                <span className="badge">Admin</span>
              </div>

              <div style={{ marginTop: 10 }}>
                <div className="label">Username (handle)</div>
                <input className="input" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="user2" />
              </div>

              <div style={{ marginTop: 10 }}>
                <div className="label">Password</div>
                <input className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="min 6 chars" />
              </div>

              <div style={{ marginTop: 10 }}>
                <div className="label">Role</div>
                <select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                  <option value="user">user</option>
                  <option value="manager">manager</option>
                  <option value="admin">admin</option>
                </select>
              </div>

              <div style={{ marginTop: 10 }}>
                <button className="btn primary" onClick={createUser}>
                  Create
                </button>
              </div>
            </div>

            <div className="panel">
              <div className="panelTitle">
                <span>Seed demo user</span>
                <span className="badge good">1 click</span>
              </div>

              <div style={{ marginTop: 10 }}>
                <div className="label">Role</div>
                <select className="input" value={seedRole} onChange={(e) => setSeedRole(e.target.value as any)}>
                  <option value="user">user</option>
                  <option value="manager">manager</option>
                </select>
              </div>

              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn primary" onClick={seedDemo}>
                  Create Demo User
                </button>
                {seeded ? (
                  <>
                    <button className="btn" onClick={copySeeded}>
                      Copy creds
                    </button>
                    <button className="btn" onClick={loginAsSeeded}>
                      Login as this user
                    </button>
                  </>
                ) : null}
              </div>

              {seeded ? (
                <div className="small" style={{ marginTop: 12, lineHeight: 1.7 }}>
                  <b>Created:</b> {seeded.user.username} ({seeded.user.role})
                  <br />
                  <b>Username:</b> {seeded.username}
                  <br />
                  <b>Password:</b> {seeded.password}
                  <br />
                  <span className="badge">Tip</span> Use “Login as this user” to test check-ins like a real employee.
                </div>
              ) : (
                <div className="small" style={{ marginTop: 12 }}>
                  This creates a non-admin account so you can submit check-ins without fighting the admin/legacy rules.
                </div>
              )}
            </div>
          </div>

          <div className="panel" style={{ marginTop: 12 }}>
            <div className="panelTitle">
              <span>All users</span>
              <span className="badge">{sorted.length}</span>
            </div>

            {!sorted.length ? (
              <div className="small" style={{ marginTop: 10 }}>No users found.</div>
            ) : (
              <div className="list" style={{ marginTop: 10 }}>
                {sorted.map((u) => (
                  <div key={u.id} className="listItemStatic">
                    <div className="listTop">
                      <div>
                        <div className="listTitle">{u.username}</div>
                        <div className="small">id {u.id}</div>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <span className="badge">{u.role}</span>
                        <select
                          className="input"
                          style={{ width: 140 }}
                          value={u.role}
                          onChange={(e) => changeRole(u.id, e.target.value as Role)}
                        >
                          <option value="user">user</option>
                          <option value="manager">manager</option>
                          <option value="admin">admin</option>
                        </select>
                      </div>
                    </div>

                    <div className="small" style={{ marginTop: 6 }}>
                      created {new Date(u.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="small" style={{ marginTop: 12 }}>
            <Link to="/dashboard">Back to Dashboard</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
