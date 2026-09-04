import { BrowserRouter } from 'react-router-dom'

import { ErrorBoundary } from './ErrorBoundary'
import { Gate } from './Gate'

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
