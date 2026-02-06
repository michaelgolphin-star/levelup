// client/src/ui/App.tsx (FULL REPLACEMENT)
import React from "react";
import { Routes, Route, Navigate, Link, useNavigate, useLocation } from "react-router-dom";
import { getToken, setToken } from "../lib/api";

import AuthPage from "./AuthPage";
import DashboardPage from "./DashboardPage";
import LandingPage from "./LandingPage";
import InviteAcceptPage from "./InviteAcceptPage";
import ResetPage from "./ResetPage";

import { OutletHomePage, OutletSessionPage } from "./OutletPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = getToken();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Topbar() {
  const nav = useNavigate();
  const loc = useLocation();
  const token = getToken();

  const isActive = (path: string) =>
    loc.pathname === path || (path !== "/" && loc.pathname.startsWith(path));

  return (
    <div className="topWrap">
      <div className="container" style={{ paddingTop: 16 }}>
        <div className="card">
          <div className="hdr topHdr">
            <div>
              <div className="topTitle">Level Up</div>
              <div className="sub">Daily structure • habits • honest reflection</div>
            </div>

            <div className="topNav">
              <Link className={`topLink ${isActive("/about") ? "active" : ""}`} to="/about">
                About
              </Link>

              {token ? (
                <>
                  <Link className={`topLink ${isActive("/dashboard") ? "active" : ""}`} to="/dashboard">
                    Dashboard
                  </Link>
                  <Link className={`topLink ${isActive("/outlet") ? "active" : ""}`} to="/outlet">
                    Counselor’s Office
                  </Link>

                  <button
                    className="btn primary"
                    onClick={() => {
                      setToken(null);
                      nav("/login");
                    }}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <Link className={`topLink ${isActive("/login") ? "active" : ""}`} to="/login">
                  Log in
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Topbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<LandingPage />} />

        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
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

        {/* Counselor’s Office */}
        <Route
          path="/outlet"
          element={
            <RequireAuth>
              <OutletHomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/outlet/:id"
          element={
            <RequireAuth>
              <OutletSessionPage />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
