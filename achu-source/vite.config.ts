import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      /**
       * §34 (Sesiunea 160) — ACHU-808: `html2canvas` se construia (47 kB gzip) și nu se descărca
       * niciodată. `jspdf` îl cere doar din `doc.html()`, pe care codul nostru nu-l apelează
       * nicăieri — măsurat, zero apeluri în `src/`. Motivele întregi, în fișierul de mai jos.
       *
       * ⛔ Se scoate rândul ăsta dacă vreodată chiar trebuie randat un PDF dintr-un HTML.
       */
      html2canvas: path.resolve(__dirname, "./src/lib/stubs/html2canvas.ts"),
    },
  },
  server: {
    // Forwards /api to the Express backend in dev, so the frontend's
    // fetch client (src/lib/apiClient.ts) can use same-origin relative
    // paths — see docs/JURNAL.md Sesiunea 3.
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});

