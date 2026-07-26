import React, { Component, ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

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
    console.error("Uncaught error in StayKids:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, fontFamily: 'sans-serif', backgroundColor: '#172d24', color: '#fff', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <h2 style={{ color: '#d6f4ad', marginBottom: 8 }}>StayKids Safety App</h2>
          <p style={{ fontSize: 13, color: '#feebee', textAlign: 'center', maxWidth: 300, marginBottom: 20 }}>
            {this.state.error?.message || 'Initialization Warning'}
          </p>
          <button
            onClick={() => {
              try { localStorage.clear() } catch (_e) {}
              window.location.reload()
            }}
            style={{ padding: '12px 24px', backgroundColor: '#287555', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 'bold' }}
          >
            Reset App State & Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

window.onerror = (msg, url, line) => {
  console.error("Global WebView Error:", msg, url, line)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
