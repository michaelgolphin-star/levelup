// client/src/ui/App.tsx (FULL REPLACEMENT)

import React from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import AuthPage from "./AuthPage";
import DashboardPage from "./DashboardPage";
import InviteAcceptPage from "./InviteAcceptPage";
import OutletInboxPage from "./OutletInboxPage";
import { OutletHomePage, OutletSessionPage } from "./OutletPage";
import ResetPage from "./ResetPage";
import VisibilityPage from "./VisibilityPage";
import { getToken } from "../lib/api";

function RequireAuth({ children }: { children: React.ReactElement }) {
  const loc = useLocation();
  const token = getToken();

  if (!token) {
    // Send them to login, but preserve where they were trying to go
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Public */}
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/reset" element={<ResetPage />} />
        <Route path="/invite/:token" element={<InviteAcceptPage />} />

        {/* Protected */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />

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

        <Route
          path="/outlet-inbox"
          element={
            <RequireAuth>
              <OutletInboxPage />
            </RequireAuth>
          }
        />

        <Route
          path="/visibility"
          element={
            <RequireAuth>
              <VisibilityPage />
            </RequireAuth>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
