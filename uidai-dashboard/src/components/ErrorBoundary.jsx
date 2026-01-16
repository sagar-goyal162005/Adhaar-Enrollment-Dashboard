import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error("UI crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message || String(this.state.error);
      return (
        <div style={{ minHeight: "100vh", padding: 24, background: "#f4f1e8" }}>
          <div
            style={{
              maxWidth: 820,
              margin: "40px auto",
              background: "white",
              borderRadius: 16,
              padding: 24,
              border: "1px solid #e5e7eb",
              boxShadow: "0 10px 25px rgba(0,0,0,.08)",
            }}
          >
            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Dashboard crashed</h1>
            <p style={{ color: "#6b7280", marginBottom: 16 }}>
              There is a runtime error in the frontend. The message is below.
            </p>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                background: "#0b1020",
                color: "#e5e7eb",
                padding: 16,
                borderRadius: 12,
                overflow: "auto",
              }}
            >
              {message}
            </pre>
            <p style={{ color: "#6b7280", marginTop: 12 }}>
              Open DevTools Console for full stack trace.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
