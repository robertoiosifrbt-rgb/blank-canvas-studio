import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// No service worker. That comes at step 7.
export default defineConfig({
  plugins: [react()],
})
