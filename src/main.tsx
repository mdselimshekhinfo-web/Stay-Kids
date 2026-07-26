import React, { Component, ReactNode } from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import { ToastContainer } from "./components/Toast"
import { reportError, initGlobalErrorHandler } from "./lib/crash-reporter"

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    reportError(error, `React ErrorBoundary - ComponentStack: ${errorInfo.componentStack}`)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, fontFamily: "sans-serif", backgroundColor: "#172d24", color: "#fff", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛡️</div>
          <h2 style={{ color: "#d6f4ad", marginBottom: 8, fontSize: 20, fontWeight: "bold" }}>StayKids Safety Protection</h2>
          <p style={{ fontSize: 13, color: "#feebee", textAlign: "center", maxWidth: 320, marginBottom: 24, lineHeight: "1.5" }}>
            {this.state.error?.message || "An unexpected rendering error occurred. Your child's background protection remains active."}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
              window.location.reload()
            }}
            style={{ padding: "14px 28px", backgroundColor: "#287555", color: "#fff", border: "none", borderRadius: 16, fontWeight: "bold", fontSize: 14, cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" }}
          >
            🔄 Reload App & Restore Protection
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

initGlobalErrorHandler()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastContainer />
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
