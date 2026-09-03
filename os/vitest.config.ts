import { defineConfig } from 'vitest/config'

// No React plugin here on purpose: esbuild compiles JSX from the `jsx`
// setting in tsconfig.app.json, and the plugin only adds fast-refresh, which
// tests do not use. Including it would also pull in a second copy of Vite.
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    // The app is used in the UK, where BST puts local midnight an hour ahead of
    // UTC. Pinning the suite here is what makes the "date must be the local
    // calendar day" tests meaningful rather than accidentally passing.
    env: { TZ: 'Europe/London' },
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
