// client/src/ui/App.tsx (FULL REPLACEMENT)
import React from "react";
import { Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";
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
  const token = getToken();

  return (
    <div className="bg-gradient-to-b from-slate-950 to-emerald-950 text-white">
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div>
            <div className="text-xl font-semibold">Level Up</div>
            <div className="mt-1 text-sm text-white/60">Daily structure • habits • honest reflection</div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/about" className="text-sm text-white/70 hover:text-white">
              About
            </Link>

            {token ? (
              <>
                <Link to="/dashboard" className="text-sm text-white/70 hover:text-white">
                  Dashboard
                </Link>
                <Link to="/outlet" className="text-sm text-white/70 hover:text-white">
                  Counselor’s Office
                </Link>

                <button
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition border border-white/10 bg-white/10 hover:bg-white/15 text-white"
                  onClick={() => {
                    setToken(null);
                    nav("/login");
                  }}
                >
                  Log out
                </button>
              </>
            ) : (
              <Link to="/login" className="text-sm text-white/70 hover:text-white">
                Log in
              </Link>
            )}
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
