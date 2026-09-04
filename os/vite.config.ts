import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  /* Servit din rădăcina domeniului, nu dintr-un subfolder ca pe GitHub Pages. */
  base: '/',
  plugins: [react()],
  define: {
    /* Din ce commit e construită aplicația. Vercel pune `VERCEL_GIT_COMMIT_SHA`
       singur la fiecare build; `VITE_COMMIT_SHA` e pentru construit de mână.
       Fără asta, „ce versiune am pe telefon?" e o discuție, nu o privire. */
    __APP_VERSION__: JSON.stringify(
      process.env.VITE_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    ),
  },
})
