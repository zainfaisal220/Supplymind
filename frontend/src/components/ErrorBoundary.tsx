import { Component, ErrorInfo, ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
  resetKey: number
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 }

  static getDerivedStateFromError(error: Error): State {
    return { error, resetKey: Date.now() }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // no-op
  }

  reset = () => {
    this.setState({ error: null, resetKey: this.state.resetKey + 1 })
  }

  render() {
    const { children, fallback } = this.props
    const { error, resetKey } = this.state
    if (error) {
      if (fallback) return fallback(error, this.reset)
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-navy-900 text-white gap-3">
          <div className="text-2xl font-mono text-red-400">⚠️ Render error</div>
          <div className="text-sm text-slate-400 max-w-md text-center">{error.message}</div>
          <button
            onClick={this.reset}
            className="mt-4 btn-primary"
          >
            Retry
          </button>
        </div>
      )
    }
    return <div key={resetKey}>{children}</div>
  }
}
