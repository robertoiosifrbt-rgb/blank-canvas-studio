import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

import './ErrorBoundary.css'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Catches a render error and offers a way out: the reset button.
 *
 * Without it, one error leaves a blank screen you cannot leave.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error:', error, info.componentStack)
  }

  private readonly reset = () => {
    this.setState({ error: null })
  }

  override render() {
    const { error } = this.state
    if (!error) {
      return this.props.children
    }

    return (
      <div className="error" role="alert">
        <h2 className="error-title">Something broke here</h2>
        <p className="error-text">Your data is untouched. You can try again.</p>
        <pre className="error-detail">{error.message}</pre>
        <button type="button" className="error-button" onClick={this.reset}>
          Try again
        </button>
      </div>
    )
  }
}
