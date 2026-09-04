import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Fără service worker. Vine la pasul 7.
export default defineConfig({
  plugins: [react()],
})
