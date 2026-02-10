// client/src/main.tsx (FULL REPLACEMENT)
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./ui/App";
import "./ui/styles.css";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error };
  }
  componentDidCatch(error: any) {
    console.error("UI crashed:", error);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="container">
          <div className="card">
            <div className="hdr">
              <div>
                <h1>Something crashed</h1>
                <div className="sub">This is a safe fallback so you’re never stuck on a blank screen.</div>
              </div>
              <button className="btn" onClick={() => window.location.reload()}>
                Reload
              </button>
            </div>
            <div className="body">
              <div className="toast bad">
                <b>Error</b>
                <div className="small" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
                  {String(this.state.error?.message || this.state.error)}
                </div>
              </div>

              <div className="small" style={{ marginTop: 12, opacity: 0.8 }}>
                If this repeats: check your console + the new “API error” toast for clues.
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children as any;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
