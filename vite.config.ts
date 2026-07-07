import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * Vite configuration — hardened after audit (Fix #40 / P2 + #25 / P1).
 *
 * - `server.host` restricted to localhost (was `::` = all interfaces).
 * - `build.rollupOptions.output.manualChunks` splits heavy vendors so the
 *   initial bundle stays lean (jspdf/xlsx/recharts/Radix in separate chunks).
 * - `build.sourcemap` enabled for Sentry stack traces (hidden in production
 *   to avoid exposing source to the browser).
 * - `define` injects `APP_VERSION` for observability.
 */
export default defineConfig(({ mode }) => ({
  server: {
    host: "localhost",
    port: 8080,
    strictPort: false,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "dev"),
  },
  build: {
    target: "es2020",
    sourcemap: mode === "development" ? true : "hidden",
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          // State / data
          "data-vendor": [
            "@tanstack/react-query",
            "react-hook-form",
            "@hookform/resolvers",
            "zod",
          ],
          // Supabase
          "supabase-vendor": ["@supabase/supabase-js"],
          // Heavy export libs (lazy-loaded where possible)
          "pdf-vendor": ["jspdf", "jspdf-autotable"],
          "excel-vendor": ["exceljs"],
          "charts-vendor": ["recharts"],
          // Date utilities
          "date-vendor": ["date-fns"],
          // Sentry
          "observability-vendor": ["@sentry/react"],
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "@supabase/supabase-js"],
  },
}));
