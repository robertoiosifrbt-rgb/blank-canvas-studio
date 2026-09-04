import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// The only two CSS files main.tsx is allowed to import.
// The rule is enforced by scripts/check-structure.mjs.
import './styles/tokens.css'
import './styles/reset.css'

import { App } from './app/App'

const host = document.getElementById('root')
if (!host) {
  throw new Error('index.html is missing #root')
}

createRoot(host).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
