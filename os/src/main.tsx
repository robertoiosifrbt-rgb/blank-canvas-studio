import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './index.css'
import './redesign.css'
import './target-shell.css'
import './workout-target.css'
import './progress-target.css'
import './styles/viewportStability.css'
import App from './app/App.tsx'
import { registerServiceWorker } from './app/registerServiceWorker'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
