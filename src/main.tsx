import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Singurele două fișiere CSS pe care main.tsx are voie să le importe.
// Regula e impusă de scripts/check-structure.mjs.
import './styles/tokens.css'
import './styles/reset.css'

import { App } from './app/App'

const gazdă = document.getElementById('root')
if (!gazdă) {
  throw new Error('Lipsește #root din index.html')
}

createRoot(gazdă).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
