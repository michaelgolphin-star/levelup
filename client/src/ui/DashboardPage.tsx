import React from "react";
import { api, type CheckIn, type Habit, type Summary, type Role, type OrgSummary } from "../lib/api";
import { fmtDateTime } from "../lib/utils";

type Tab = "checkin" | "history" | "habits" | "analytics" | "program" | "org";

async function downloadCsv(path: string, filename: string) {
  const token = localStorage.getItem("levelup_token") || "";
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


function Tabs({ tab, setTab, role }: { tab: Tab; setTab: (t: Tab) => void; role: Role }) {
  const items: Array<[Tab, string]> = [
    ["checkin", "Check-in"],
    ["history", "History"],
    ["habits", "Habits"],
    ["analytics", "My Patterns"]
  ];
  const programItems: Array<[Tab, string]> = role === "admin" || role === "manager"
    ? [["program", "Program Trends"], ["org", "People & Roles"]]
    : [];

  return (
    <div className="tabs">
      {[...items, ...programItems].map(([k, label]) => (
        <div key={k} className={"tab " + (tab === k ? "active" : "")} onClick={() => setTab(k)}>
          {label}
        </div>
      ))}
    </div>
  );
}

function CheckInForm({ onCreated }: { onCreated: () => void }) {
  const [mood, setMood] = React.useState(7);
  const [energy, setEnergy] = React.useState(6);
  const [stress, setStress] = React.useState(4);
  const [note, setNote] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const tagsArr = tags.split(",").map(s => s.trim()).filter(Boolean).slice(0, 20);
      await api.createCheckin({ mood, energy, stress, note: note.trim() || undefined, tags: tagsArr });
      setNote("");
      setTags("");
      setMsg("Saved ✅ Keep going.");
      onCreated();
    } catch (e: any) {
      setMsg(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="hdr">
        <div>
          <h1>Check in</h1>
          <div className="sub">Show up. Check in. Adjust. Repeat.</div>
        </div>
        <span className="badge">1–10 scale</span>
      </div>
      <div className="body">
        <form onSubmit={submit} className="row">
          <div className="col">
            <div className="label">Mood</div>
            <input className="input" type="number" min={1} max={10} value={mood} onChange={(e) => setMood(Number(e.target.value))} />
          </div>
          <div className="col">
            <div className="label">Energy</div>
            <input className="input" type="number" min={1} max={10} value={energy} onChange={(e) => setEnergy(Number(e.target.value))} />
          </div>
          <div className="col">
            <div className="label">Stress</div>
            <input className="input" type="number" min={1} max={10} value={stress} onChange={(e) => setStress(Number(e.target.value))} />
          </div>
          <div className="col" style={{ flexBasis: "100%" }}>
            <div className="label">Note (optional)</div>
            <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What’s going on today? What do you need?" />
          </div>
          <div className="col" style={{ flexBasis: "100%" }}>
            <div className="label">Tags (comma separated)</div>
            <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="workout, focus, anxious" />
          </div>
          <div className="col" style={{ flexBasis: 200 }}>
            <button className="btn primary" disabled={loading}>
              {loading ? "Saving..." : "Save check-in"}
            </button>
          </div>
        </form>

        {msg && <div className="small" style={{ marginTop: 10 }}>{msg}</div>}
      </div>
    </div>
  );
}

function History({ checkins, onDelete }: { checkins: CheckIn[]; onDelete: (id: string) => void }) {
  return (
    <div className="card">
      <div className="hdr">
        <div>
          <h1>Your history</h1>
          <div className="sub">Most recent first.</div>
        </div>
        <span className="badge">{checkins.length} records</span>
      </div>
      <div className="body" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Mood</th>
              <th>Energy</th>
              <th>Stress</th>
              <th>Note</th>
              <th>Tags</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {checkins.map(c => (
              <tr key={c.id}>
                <td>{fmtDateTime(c.ts)}</td>
                <td>{c.mood}</td>
                <td>{c.energy}</td>
                <td>{c.stress}</td>
                <td className="small">{c.note || ""}</td>
                <td className="small">{(JSON.parse(c.tagsJson || "[]") as string[]).join(", ")}</td>
                <td>
                  <button className="btn danger" onClick={() => onDelete(c.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {checkins.length === 0 && (
              <tr><td colSpan={7} className="small">No check-ins yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Habits({ habits, refresh }: { habits: Habit[]; refresh: () => void }) {
  const [name, setName] = React.useState("");
  const [target, setTarget] = React.useState(3);
  const [loading, setLoading] = React.useState(false);

  async function add() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await api.createHabit({ name: name.trim(), targetPerWeek: target });
      setName("");
      setTarget(3);
      refresh();
    } finally {
      setLoading(false);
    }
  }

  async function archive(id: string) {
    await api.archiveHabit(id);
    refresh();
  }

  return (
    <div className="card">
      <div className="hdr">
        <div>
          <h1>Habits</h1>
          <div className="sub">Tiny targets. Honest wins.</div>
        </div>
        <span className="badge">{habits.filter(h => !h.archivedAt).length} active</span>
      </div>
      <div className="body">
        <div className="row">
          <div className="col">
            <div className="label">Habit name</div>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Gym, reading, journaling..." />
          </div>
          <div className="col" style={{ flexBasis: 180 }}>
            <div className="label">Target / week</div>
            <input className="input" type="number" min={1} max={14} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
          </div>
          <div className="col" style={{ flexBasis: 180, alignSelf: "flex-end" }}>
            <button className="btn primary" onClick={add} disabled={loading}>
              {loading ? "Adding..." : "Add habit"}
            </button>
          </div>
        </div>

        <hr />
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Target/week</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {habits.map(h => (
              <tr key={h.id}>
                <td>{h.name}</td>
                <td>{h.targetPerWeek}</td>
                <td className="small">{h.archivedAt ? "Archived" : "Active"}</td>
                <td>
                  {!h.archivedAt && (
                    <button className="btn" onClick={() => archive(h.id)}>Archive</button>
                  )}
                </td>
              </tr>
            ))}
            {habits.length === 0 && (
              <tr><td colSpan={4} className="small">No habits yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MyAnalytics({ summary }: { summary: Summary | null }) {
  if (!summary) {
    return (
      <div className="card">
        <div className="hdr">
          <h1>My patterns</h1>
          <span className="badge">Loading…</span>
        </div>
        <div className="body" />
      </div>
    );
  }

  const mood = summary.overall.moodAvg ? summary.overall.moodAvg.toFixed(1) : "--";
  const energy = summary.overall.energyAvg ? summary.overall.energyAvg.toFixed(1) : "--";
  const stress = summary.overall.stressAvg ? summary.overall.stressAvg.toFixed(1) : "--";

  return (
    <div className="card">
      <div className="hdr">
        <div>
          <h1>My patterns</h1>
          <div className="sub">Last {summary.days} days • streak = days with ≥1 check-in</div>
        </div>
        <span className="badge">Streak: {summary.streak}</span>
      </div>
      <div className="body">
        <div className="row">
          <div className="col kpi">
            <div className="small">Avg mood</div>
            <div className="num">{mood}</div>
          </div>
          <div className="col kpi">
            <div className="small">Avg energy</div>
            <div className="num">{energy}</div>
          </div>
          <div className="col kpi">
            <div className="small">Avg stress</div>
            <div className="num">{stress}</div>
          </div>
          <div className="col kpi">
            <div className="small">Total check-ins</div>
            <div className="num">{summary.overall.total}</div>
          </div>
        </div>

        <hr />
        <div className="small" style={{ marginBottom: 8 }}>Daily averages</div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Mood</th>
                <th>Energy</th>
                <th>Stress</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody>
              {summary.byDay.slice().reverse().map(d => (
                <tr key={d.dayKey}>
                  <td>{d.dayKey}</td>
                  <td>{Number(d.moodAvg).toFixed(1)}</td>
                  <td>{Number(d.energyAvg).toFixed(1)}</td>
                  <td>{Number(d.stressAvg).toFixed(1)}</td>
                  <td>{d.count}</td>
                </tr>
              ))}
              {summary.byDay.length === 0 && (
                <tr><td colSpan={5} className="small">No data yet. Add a check-in.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProgramAnalytics({ summary }: { summary: OrgSummary | null }) {
  if (!summary) {
    return (
      <div className="card">
        <div className="hdr">
          <h1>Program trends</h1>
          <span className="badge">Loading…</span>
        </div>
        <div className="body" />
      </div>
    );
  }

  const mood = summary.overall.moodAvg ? summary.overall.moodAvg.toFixed(1) : "--";
  const energy = summary.overall.energyAvg ? summary.overall.energyAvg.toFixed(1) : "--";
  const stress = summary.overall.stressAvg ? summary.overall.stressAvg.toFixed(1) : "--";

  return (
    <div className="card">
      <div className="hdr">
        <div>
          <h1>Program trends</h1>
          <div className="sub">Last {summary.days} days • signals, not judgment</div>
        </div>
        <span className="badge">{summary.overall.users} people</span>
      </div>
      <div className="body">
        <div className="row">
          <div className="col kpi">
            <div className="small">Avg mood</div>
            <div className="num">{mood}</div>
          </div>
          <div className="col kpi">
            <div className="small">Avg energy</div>
            <div className="num">{energy}</div>
          </div>
          <div className="col kpi">
            <div className="small">Avg stress</div>
            <div className="num">{stress}</div>
          </div>
          <div className="col kpi">
            <div className="small">Total check-ins</div>
            <div className="num">{summary.overall.checkins}</div>
          </div>
        </div>

        <hr />
        <div className="small" style={{ marginBottom: 8 }}>Daily cohort averages</div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Mood</th>
                <th>Energy</th>
                <th>Stress</th>
                <th>Check-ins</th>
                <th>Users</th>
              </tr>
            </thead>
            <tbody>
              {summary.byDay.slice().reverse().map(d => (
                <tr key={d.dayKey}>
                  <td>{d.dayKey}</td>
                  <td>{Number(d.moodAvg).toFixed(1)}</td>
                  <td>{Number(d.energyAvg).toFixed(1)}</td>
                  <td>{Number(d.stressAvg).toFixed(1)}</td>
                  <td>{d.checkins}</td>
                  <td>{d.users}</td>
                </tr>
              ))}
              {summary.byDay.length === 0 && (
                <tr><td colSpan={6} className="small">No program data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <hr />
        <div className="small" style={{ marginBottom: 8 }}>
          Light risk signal (last 7 days): users with low avg mood or high avg stress (requires ≥3 check-ins).
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Avg mood</th>
                <th>Avg stress</th>
                <th>Check-ins</th>
              </tr>
            </thead>
            <tbody>
              {summary.risk.map(r => (
                <tr key={r.userId}>
                  <td>{r.username}</td>
                  <td>{Number(r.moodAvg).toFixed(1)}</td>
                  <td>{Number(r.stressAvg).toFixed(1)}</td>
                  <td>{r.count}</td>
                </tr>
              ))}
              {summary.risk.length === 0 && (
                <tr><td colSpan={4} className="small">No risk signals right now.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OrgPanel({ role, myUserId }: { role: Role; myUserId: string }) {
  const [orgName, setOrgName] = React.useState<string>("…");
  const [users, setUsers] = React.useState<Array<{ id: string; username: string; role: Role }>>([]);
  const [err, setErr] = React.useState<string | null>(null);

  // Invite links
  const [inviteRole, setInviteRole] = React.useState<Role>("user");
  const [inviteDays, setInviteDays] = React.useState(7);
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);

  // Admin password reset tokens
  const [resetUserId, setResetUserId] = React.useState<string>("");
  const [resetToken, setResetToken] = React.useState<string | null>(null);
  const [resetExpiresAt, setResetExpiresAt] = React.useState<string | null>(null);

  // Profiles
  const [myProfile, setMyProfile] = React.useState<any>(null);
  const [myFullName, setMyFullName] = React.useState("");
  const [myEmail, setMyEmail] = React.useState("");
  const [myPhone, setMyPhone] = React.useState("");
  const [myTags, setMyTags] = React.useState("");

  // Program notes / user detail
  const [selectedUserId, setSelectedUserId] = React.useState<string>("");
  const [selectedProfile, setSelectedProfile] = React.useState<any>(null);
  const [notes, setNotes] = React.useState<any[]>([]);
  const [newNote, setNewNote] = React.useState("");

  async function load() {
    setErr(null);
    try {
      const o = await api.org();
      setOrgName(o.org?.name || "—");
      const u = await api.users();
      setUsers(u.users.map(x => ({ id: x.id, username: x.username, role: x.role })));
      if (!resetUserId && u.users.length) setResetUserId(u.users[0].id);

      const mp = await api.getProfile(myUserId);
      setMyProfile(mp.profile);
      setMyFullName(mp.profile.fullName || "");
      setMyEmail(mp.profile.email || "");
      setMyPhone(mp.profile.phone || "");
      setMyTags((JSON.parse(mp.profile.tagsJson || "[]") as string[]).join(", "));
    } catch (e: any) {
      setErr(e.message || "Failed");
    }
  }

  React.useEffect(() => { load(); }, []);

  async function changeRole(userId: string, roleTo: Role) {
    try {
      await api.setRole(userId, roleTo);
      load();
    } catch (e: any) {
      setErr(e.message || "Failed");
    }
  }

  async function createInvite() {
    setErr(null);
    setInviteUrl(null);
    try {
      const resp = await api.createInvite({ role: inviteRole, expiresInDays: inviteDays });
      setInviteUrl(window.location.origin + resp.urlPath);
    } catch (e: any) {
      setErr(e.message || "Failed to create invite");
    }
  }

  async function generateResetToken() {
    if (!resetUserId) return;
    setErr(null);
    setResetToken(null);
    setResetExpiresAt(null);
    try {
      const resp = await api.adminCreateResetToken(resetUserId, 60);
      setResetToken(resp.reset.token);
      setResetExpiresAt(resp.reset.expiresAt);
    } catch (e: any) {
      setErr(e.message || "Failed to generate reset token");
    }
  }

  async function saveMyProfile() {
    setErr(null);
    try {
      const tags = myTags.split(",").map(s => s.trim()).filter(Boolean).slice(0, 30);
      const resp = await api.updateProfile(myUserId, {
        fullName: myFullName.trim() || null,
        email: myEmail.trim() || null,
        phone: myPhone.trim() || null,
        tags
      });
      setMyProfile(resp.profile);
    } catch (e: any) {
      setErr(e.message || "Failed to save profile");
    }
  }

  async function openUser(userId: string) {
    setSelectedUserId(userId);
    setErr(null);
    try {
      const p = await api.getProfile(userId);
      setSelectedProfile(p.profile);
      if (role === "admin" || role === "manager") {
        const n = await api.listNotes(userId, 200);
        setNotes(n.notes);
      } else {
        setNotes([]);
      }
    } catch (e: any) {
      setErr(e.message || "Failed to load user");
    }
  }

  async function saveSelectedProfile() {
    if (!selectedUserId) return;
    setErr(null);
    try {
      const tags = (selectedProfile?.tagsJson ? (JSON.parse(selectedProfile.tagsJson) as string[]) : []);
      const resp = await api.updateProfile(selectedUserId, {
        fullName: selectedProfile?.fullName ?? null,
        email: selectedProfile?.email ?? null,
        phone: selectedProfile?.phone ?? null,
        tags
      });
      setSelectedProfile(resp.profile);
    } catch (e: any) {
      setErr(e.message || "Failed to save profile");
    }
  }

  async function addNote() {
    if (!selectedUserId || !newNote.trim()) return;
    setErr(null);
    try {
      await api.addNote(selectedUserId, newNote.trim());
      setNewNote("");
      const n = await api.listNotes(selectedUserId, 200);
      setNotes(n.notes);
    } catch (e: any) {
      setErr(e.message || "Failed to add note");
    }
  }

  return (
    <div className="card">
      <div className="hdr">
        <div>
          <h1>People & tools</h1>
          <div className="sub">Org: {orgName}</div>
        </div>
        <span className="badge">Role: {role}</span>
      </div>
      <div className="body">
        {err && <div className="small" style={{ color: "#fb7185" }}>{err}</div>}

        <div className="row">
          <div className="col">
            <div className="kpi">
              <div className="small">Exports</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <button className="btn" onClick={() => downloadCsv("/api/export/users.csv", "users.csv")}>Download users.csv</button>
                <button className="btn" onClick={() => downloadCsv("/api/export/checkins.csv?sinceDays=30", "checkins_30d.csv")}>Check-ins (30d)</button>
                <button className="btn" onClick={() => downloadCsv("/api/export/checkins.csv?sinceDays=365", "checkins_365d.csv")}>Check-ins (365d)</button>
              </div>
              <div className="small" style={{ marginTop: 10 }}>CSV downloads for reporting.</div>
            </div>
          </div>

          {(role === "admin") && (
            <div className="col">
              <div className="kpi">
                <div className="small">Invite link</div>
                <div className="row" style={{ marginTop: 10 }}>
                  <div className="col" style={{ flexBasis: 160 }}>
                    <div className="label">Role</div>
                    <select className="select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
                      <option value="user">user</option>
                      <option value="manager">manager</option>
                      <option value="admin">admin</option>
                    </select>
                  </div>
                  <div className="col" style={{ flexBasis: 160 }}>
                    <div className="label">Expires (days)</div>
                    <input className="input" type="number" min={1} max={30} value={inviteDays} onChange={(e) => setInviteDays(Number(e.target.value))} />
                  </div>
                  <div className="col" style={{ flexBasis: 160, alignSelf: "flex-end" }}>
                    <button className="btn primary" onClick={createInvite}>Create link</button>
                  </div>
                </div>
                {inviteUrl && (
                  <div style={{ marginTop: 10 }}>
                    <div className="label">Share this link</div>
                    <input className="input" value={inviteUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
                    <div className="small">Tip: tap to select, then copy.</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <hr />

        <div className="row">
          <div className="col">
            <h3 style={{ marginTop: 0 }}>My profile</h3>
            <div className="small">This is for contact + context. Keep it simple.</div>
            <div className="row" style={{ marginTop: 10 }}>
              <div className="col">
                <div className="label">Full name</div>
                <input className="input" value={myFullName} onChange={(e) => setMyFullName(e.target.value)} />
              </div>
              <div className="col">
                <div className="label">Email</div>
                <input className="input" value={myEmail} onChange={(e) => setMyEmail(e.target.value)} />
              </div>
              <div className="col">
                <div className="label">Phone</div>
                <input className="input" value={myPhone} onChange={(e) => setMyPhone(e.target.value)} />
              </div>
              <div className="col" style={{ flexBasis: "100%" }}>
                <div className="label">Tags (comma separated)</div>
                <input className="input" value={myTags} onChange={(e) => setMyTags(e.target.value)} placeholder="strengths, goals, support" />
              </div>
              <div className="col" style={{ flexBasis: 180 }}>
                <button className="btn primary" onClick={saveMyProfile}>Save profile</button>
              </div>
            </div>
          </div>

          {(role === "admin") && (
            <div className="col">
              <h3 style={{ marginTop: 0 }}>Password reset (admin)</h3>
              <div className="small">Generates a temporary reset token (demo: shown on screen).</div>
              <div className="row" style={{ marginTop: 10, alignItems: "flex-end" }}>
                <div className="col">
                  <div className="label">User</div>
                  <select className="select" value={resetUserId} onChange={(e) => setResetUserId(e.target.value)}>
                    {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.role})</option>)}
                  </select>
                </div>
                <div className="col" style={{ flexBasis: 200 }}>
                  <button className="btn primary" onClick={generateResetToken}>Generate token</button>
                </div>
              </div>
              {resetToken && (
                <div style={{ marginTop: 10 }}>
                  <div className="label">Reset token</div>
                  <input className="input" value={resetToken} readOnly onFocus={(e) => e.currentTarget.select()} />
                  <div className="small">Expires: {new Date(resetExpiresAt || "").toLocaleString()}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <hr />

        <div className="row">
          <div className="col">
            <h3 style={{ marginTop: 0 }}>Roster</h3>
            <div className="small">Click a user to view profile + (staff) notes.</div>
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    {(role === "admin") ? <th>Change role</th> : <th />}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.username}</td>
                      <td>{u.role}</td>
                      {(role === "admin") ? (
                        <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {(["user","manager","admin"] as Role[]).map(r => (
                            <button key={r} className="btn" disabled={u.role === r} onClick={() => changeRole(u.id, r)}>
                              {r}
                            </button>
                          ))}
                        </td>
                      ) : <td />}
                      <td><button className="btn" onClick={() => openUser(u.id)}>Open</button></td>
                    </tr>
                  ))}
                  {users.length === 0 && <tr><td colSpan={4} className="small">No users</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="col">
            <h3 style={{ marginTop: 0 }}>User detail</h3>
            {!selectedUserId ? (
              <div className="small">Select a user from the roster.</div>
            ) : (
              <>
                <div className="small">Profile</div>
                <div className="row" style={{ marginTop: 8 }}>
                  <div className="col">
                    <div className="label">Full name</div>
                    <input className="input" value={selectedProfile?.fullName || ""} onChange={(e) => setSelectedProfile({ ...selectedProfile, fullName: e.target.value })} />
                  </div>
                  <div className="col">
                    <div className="label">Email</div>
                    <input className="input" value={selectedProfile?.email || ""} onChange={(e) => setSelectedProfile({ ...selectedProfile, email: e.target.value })} />
                  </div>
                  <div className="col">
                    <div className="label">Phone</div>
                    <input className="input" value={selectedProfile?.phone || ""} onChange={(e) => setSelectedProfile({ ...selectedProfile, phone: e.target.value })} />
                  </div>
                  <div className="col" style={{ flexBasis: 180, alignSelf: "flex-end" }}>
                    <button className="btn primary" onClick={saveSelectedProfile}>Save</button>
                  </div>
                </div>

                {(role === "admin" || role === "manager") && (
                  <>
                    <hr />
                    <div className="small">Staff notes</div>
                    <div className="row" style={{ marginTop: 8, alignItems: "flex-end" }}>
                      <div className="col" style={{ flexBasis: "100%" }}>
                        <div className="label">Add note</div>
                        <textarea className="textarea" rows={3} value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Context, follow-up, support needs…" />
                      </div>
                      <div className="col" style={{ flexBasis: 180 }}>
                        <button className="btn primary" onClick={addNote}>Add</button>
                      </div>
                    </div>

                    <div style={{ marginTop: 10, maxHeight: 260, overflowY: "auto" }} className="card body">
                      {notes.length === 0 ? (
                        <div className="small">No notes yet.</div>
                      ) : (
                        notes.map(n => (
                          <div key={n.id} style={{ marginBottom: 10 }}>
                            <div className="small"><b>{n.authorUsername}</b> • {new Date(n.ts).toLocaleString()}</div>
                            <div className="small">{n.note}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <hr />
        <div className="small">
          Security note: password resets and invites are “demo-friendly” in this build (tokens are shown on screen).
          In a production build, you’d deliver tokens via email/SMS.
        </div>
      </div>
    </div>
  );
}


export default function DashboardPage() {
  const [tab, setTab] = React.useState<Tab>("checkin");
  const [checkins, setCheckins] = React.useState<CheckIn[]>([]);
  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [mySummary, setMySummary] = React.useState<Summary | null>(null);
  const [programSummary, setProgramSummary] = React.useState<OrgSummary | null>(null);
  const [role, setRole] = React.useState<Role>("user");
  const [myUserId, setMyUserId] = React.useState<string>("");

  async function loadAll() {
    const c = await api.listCheckins();
    setCheckins(c.checkins);
    const h = await api.listHabits();
    setHabits(h.habits);
    const s = await api.summary(30);
    setMySummary(s.summary);
  }

  async function loadProgram() {
    if (role !== "admin" && role !== "manager") return;
    const ps = await api.orgSummary(30);
    setProgramSummary(ps.summary);
  }

  React.useEffect(() => {
    fetch("/api/me", { headers: { Authorization: `Bearer ${localStorage.getItem("levelup_token")}` } })
      .then(r => r.json())
      .then(d => { setRole(d?.auth?.role || "user"); setMyUserId(d?.auth?.userId || ""); })
      .catch(() => setRole("user"));
  }, []);

  React.useEffect(() => {
    loadAll();
  }, []);

  React.useEffect(() => {
    loadProgram();
  }, [role]);

  async function onDelete(id: string) {
    await api.deleteCheckin(id);
    loadAll();
    loadProgram();
  }

  return (
    <div className="container">
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="hdr">
          <div>
            <h1>Dashboard</h1>
            <div className="sub">Build self-trust through repetition.</div>
          </div>
          <Tabs tab={tab} setTab={setTab} role={role} />
        </div>
      </div>

      {tab === "checkin" && <CheckInForm onCreated={() => { loadAll(); loadProgram(); }} />}
      {tab === "history" && <History checkins={checkins} onDelete={onDelete} />}
      {tab === "habits" && <Habits habits={habits} refresh={() => { loadAll(); loadProgram(); }} />}
      {tab === "analytics" && <MyAnalytics summary={mySummary} />}
      {tab === "program" && <ProgramAnalytics summary={programSummary} />}
      {tab === "org" && <OrgPanel role={role} myUserId={myUserId} />}
    </div>
  );
}
