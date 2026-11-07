/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.TRACETEST_API_URL || `http://127.0.0.1:${process.env.TRACETEST_PORT || "8000"}`,
        changeOrigin: false,
      },
    },
  },
  build: { rollupOptions: { output: { manualChunks: { charts: ["recharts"], vendor: ["react", "react-dom", "react-router-dom", "@tanstack/react-query", "@tanstack/react-table"] } } } },
  test: { environment: "jsdom", globals: true, setupFiles: ["./tests/setup.ts"], include: ["tests/**/*.test.tsx"] },
});
