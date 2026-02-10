// client/src/main.tsx (FULL REPLACEMENT — adds ErrorBoundary so you never get a silent gray screen)
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./ui/App";
import "./styles.css";

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { error };
  }

  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error("UI crashed:", error, info);
  }

  render() {
    if (this.state.error) {
      const msg =
        typeof this.state.error?.message === "string"
          ? this.state.error.message
          : "The app hit an unexpected error.";

      return (
        <div className="container">
          <div className="card">
            <div className="hdr">
              <div>
                <h1>Something broke</h1>
                <div className="sub">This is a UI runtime error (not a login problem).</div>
              </div>
              <span className="badge">ErrorBoundary</span>
            </div>

            <div className="body">
              <div className="toast bad">{msg}</div>

              <div className="small" style={{ marginTop: 12, lineHeight: 1.7 }}>
                Try a hard refresh. If it keeps happening, open DevTools console and copy the error log.
              </div>

              <div style={{ marginTop: 12 }}>
                <button className="btn" onClick={() => location.reload()}>
                  Reload
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
