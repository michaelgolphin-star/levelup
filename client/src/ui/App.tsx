// client/src/ui/App.tsx (FULL REPLACEMENT)
import React, { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Route, Routes, Navigate, Link } from "react-router-dom";

import AuthPage from "./AuthPage";
import DashboardPage from "./DashboardPage";
import InviteAcceptPage from "./InviteAcceptPage";
import LandingPage from "./LandingPage";
import OutletInboxPage from "./OutletInboxPage";
import OutletPage from "./OutletPage";
import ResetPage from "./ResetPage";
import TrustPage from "./TrustPage";
import VisibilityPage from "./VisibilityPage";
import UsersPage from "./UsersPage";

function ApiErrorToaster() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const onErr = (ev: any) => {
      const d = ev?.detail || {};
      const text = `[${d.status || "?"}] ${d.method || ""} ${d.path || ""} — ${d.message || "Error"}`;
      setMsg(text);
      window.setTimeout(() => setMsg(null), 6500);
    };
    window.addEventListener("levelup_api_error", onErr as any);
    return () => window.removeEventListener("levelup_api_error", onErr as any);
  }, []);

  if (!msg) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 14,
        right: 14,
        zIndex: 9999,
        maxWidth: 420,
      }}
    >
      <div className="toast bad" style={{ boxShadow: "0 10px 30px rgba(0,0,0,.25)" }}>
        <b>API error</b>
        <div className="small" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
          {msg}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ApiErrorToaster />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/invite/:token" element={<InviteAcceptPage />} />
        <Route path="/reset/:token" element={<ResetPage />} />
        <Route path="/outlet" element={<OutletPage />} />
        <Route path="/outlet-inbox" element={<OutletInboxPage />} />
        <Route path="/visibility" element={<VisibilityPage />} />
        <Route path="/trust" element={<TrustPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <div className="small" style={{ position: "fixed", bottom: 10, right: 12, opacity: 0.65 }}>
        <Link to="/dashboard">Dashboard</Link> • <Link to="/users">Users</Link>
      </div>
    </BrowserRouter>
  );
}
