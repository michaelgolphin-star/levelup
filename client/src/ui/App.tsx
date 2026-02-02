import React from "react";
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
import { getToken, setToken } from "../lib/api";
import AuthPage from "./AuthPage";
import DashboardPage from "./DashboardPage";
import LandingPage from "./LandingPage";
import InviteAcceptPage from "./InviteAcceptPage";
import ResetPage from "./ResetPage";

function Topbar() {
  const nav = useNavigate();
  const token = getToken();
  return (
    <div className="container">
      <div className="card hdr">
        <div>
          <h1>Level Up</h1>
          <div className="sub">
            Daily structure • habits • honest reflection
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link className="badge" to="/">About</Link>
          <Link className="badge" to="/dashboard">Dashboard</Link>
          {token ? (
            <button
              className="btn"
              onClick={() => {
                setToken(null);
                nav("/login");
              }}
            >
              Log out
            </button>
          ) : (
            <span className="badge">Not logged in</span>
          )}
        </div>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <Topbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/about" element={<LandingPage />} />
        <Route path="/invite/:token" element={<InviteAcceptPage />} />
        <Route path="/reset" element={<ResetPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
