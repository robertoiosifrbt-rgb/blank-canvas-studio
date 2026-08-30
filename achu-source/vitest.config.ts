import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Sesiunea 29 — frontend test harness. The project had none: `backend/` has its
 * own vitest config and 454 tests, but nothing covered `src/`.
 *
 * `include` is scoped to `src/` deliberately. Running plain `vitest` from the
 * repo root previously picked up backend/src/**\/*.test.ts too, which then failed
 * en masse because this config does not set the backend's TEST_DATABASE_URL —
 * 128 confusing failures that looked like real breakage. Keep the two suites
 * separate: `npm test` here, `npx vitest run` inside backend/.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    /**
     * `scripts/` is here for ACHU-399 only: `scripts/serve-frontend.mjs` is how the
     * built frontend is served in production, and until it existed nothing in the
     * repository described that at all — the platform guessed, guessed without a
     * history-API fallback, and two roles could not reach their landing screen.
     * A file that decides whether anyone reaches the application belongs under test.
     */
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    /**
     * ⚠️ Node, not jsdom, for those: they bind a real HTTP server. Left on jsdom
     * they still pass today, which is exactly why the override is written down —
     * the next jsdom upgrade that ships its own `fetch` would silently change what
     * the assertions are talking to.
     */
    environmentMatchGlobs: [['scripts/**', 'node']],
    setupFiles: ['./src/test/setup.ts'],
  },
});

