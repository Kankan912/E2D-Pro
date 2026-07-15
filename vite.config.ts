import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Vite configuration — hardened after audit.
 *
 * - `server.host` restricted to localhost (was `::` = all interfaces).
 * - `build.rollupOptions.output.manualChunks` splits heavy vendors so the
 *   initial bundle stays lean (jspdf/exceljs/recharts/Radix in separate chunks).
 * - `build.sourcemap` enabled for Sentry stack traces (hidden in production
 *   to avoid exposing source to the browser).
 */
export default defineConfig(({ mode }) => ({
  server: {
    host: "localhost",
    port: 8080,
    strictPort: false,
  },
  plugins: [react()],
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
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "data-vendor": [
            "@tanstack/react-query",
            "react-hook-form",
            "@hookform/resolvers",
            "zod",
          ],
          "supabase-vendor": ["@supabase/supabase-js"],
          "pdf-vendor": ["jspdf", "jspdf-autotable"],
          "excel-vendor": ["exceljs"],
          "charts-vendor": ["recharts"],
          "date-vendor": ["date-fns"],
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
