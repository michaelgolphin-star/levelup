// client/src/main.tsx (FULL REPLACEMENT)

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./ui/App";
import "./ui/styles.css";

/**
 * If React crashes during render or a promise rejects, iOS Safari can look like
 * a “blank gradient” screen. This overlay makes the real error visible.
 */
function showCrash(details: string) {
  try {
    const id = "crash-overlay";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.style.position = "fixed";
      el.style.inset = "0";
      el.style.zIndex = "99999";
      el.style.padding = "16px";
      el.style.overflow = "auto";
      el.style.background = "rgba(0,0,0,0.88)";
      el.style.color = "white";
      el.style.fontFamily =
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
      document.body.appendChild(el);
    }
    el.innerHTML = `
      <div style="max-width: 900px; margin: 0 auto;">
        <div style="font-size: 18px; font-weight: 800; margin-bottom: 12px;">App crashed (runtime)</div>
        <div style="font-size: 12px; opacity: 0.85; margin-bottom: 10px;">
          This message is shown intentionally so we can fix the real cause.
        </div>
        <pre style="white-space: pre-wrap; line-height: 1.35; font-size: 12px;">${escapeHtml(details)}</pre>
      </div>
    `;
  } catch {
    // ignore overlay failures
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { err?: string }
> {
  constructor(props: any) {
    super(props);
    this.state = {};
  }
  static getDerivedStateFromError(err: any) {
    return { err: String(err?.stack || err?.message || err) };
  }
  componentDidCatch(err: any) {
    const msg = String(err?.stack || err?.message || err);
    showCrash(msg);
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 16, color: "white" }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>App crashed</div>
          <pre style={{ whiteSpace: "pre-wrap" }}>{this.state.err}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

window.addEventListener("error", (e) => {
  showCrash(String((e as any)?.error?.stack || (e as any)?.message || e));
});
window.addEventListener("unhandledrejection", (e) => {
  showCrash(String((e as any)?.reason?.stack || (e as any)?.reason || e));
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
