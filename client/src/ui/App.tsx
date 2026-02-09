// client/src/ui/App.tsx (FULL REPLACEMENT)

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LandingPage from "./LandingPage";
import AuthPage from "./AuthPage";
import DashboardPage from "./DashboardPage";
import InviteAcceptPage from "./InviteAcceptPage";
import { OutletHomePage, OutletSessionPage } from "./OutletPage";
import ResetPage from "./ResetPage";
import TrustPage from "./TrustPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />

        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/invite/:token" element={<InviteAcceptPage />} />

        {/* Counselor’s Office */}
        <Route path="/outlet" element={<OutletHomePage />} />
        <Route path="/outlet/:id" element={<OutletSessionPage />} />

        {/* Password reset */}
        <Route path="/reset" element={<ResetPage />} />

        {/* Trust loop */}
        <Route path="/trust" element={<TrustPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
