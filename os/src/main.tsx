import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './gymStyles.css'
import { OsApp } from './features/os/OsApp'
import { registerServiceWorker } from './app/registerServiceWorker'

registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OsApp />
  </StrictMode>,
)
