// client/src/ui/App.tsx (FULL REPLACEMENT)

import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthPage from "./AuthPage";
import DashboardPage from "./DashboardPage";
import InviteAcceptPage from "./InviteAcceptPage";
import OutletInboxPage from "./OutletInboxPage";
import { OutletHomePage, OutletSessionPage } from "./OutletPage";
import ResetPage from "./ResetPage";
import VisibilityPage from "./VisibilityPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />

        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/invite/:token" element={<InviteAcceptPage />} />

        <Route path="/reset" element={<ResetPage />} />

        <Route path="/outlet" element={<OutletHomePage />} />
        <Route path="/outlet/:id" element={<OutletSessionPage />} />

        <Route path="/outlet-inbox" element={<OutletInboxPage />} />

        {/* A2: mini doctrine page */}
        <Route path="/visibility" element={<VisibilityPage />} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
