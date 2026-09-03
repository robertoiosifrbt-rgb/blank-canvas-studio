import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/GYM-APP/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.VITE_COMMIT_SHA ?? 'dev'),
  },
})
