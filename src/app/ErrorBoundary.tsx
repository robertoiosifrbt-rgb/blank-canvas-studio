import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

import './ErrorBoundary.css'

type Props = { children: ReactNode }
type State = { eroare: Error | null }

/**
 * Prinde o eroare de randare și oferă o ieșire: butonul de reset.
 * Fără el, o singură eroare lasă un ecran gol din care nu se mai poate pleca.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { eroare: null }

  static getDerivedStateFromError(eroare: Error): State {
    return { eroare }
  }

  override componentDidCatch(eroare: Error, info: ErrorInfo) {
    console.error('Eroare de randare:', eroare, info.componentStack)
  }

  private readonly reia = () => {
    this.setState({ eroare: null })
  }

  override render() {
    const { eroare } = this.state
    if (!eroare) {
      return this.props.children
    }

    return (
      <div className="eroare" role="alert">
        <h2 className="eroare-titlu">Ceva s-a rupt aici</h2>
        <p className="eroare-text">
          Datele tale sunt neatinse. Poți reîncerca ecranul.
        </p>
        <pre className="eroare-detaliu">{eroare.message}</pre>
        <button type="button" className="eroare-buton" onClick={this.reia}>
          Reîncearcă
        </button>
      </div>
    )
  }
}
