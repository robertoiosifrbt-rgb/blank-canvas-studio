import { BrowserRouter } from 'react-router-dom'

import { ErrorBoundary } from './ErrorBoundary'
import { Poarta } from './Poarta'

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Poarta />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
