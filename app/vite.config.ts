import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    // Geliştirmede API ayrı süreçte (npm run dev ikisini birlikte başlatır)
    proxy: { "/api": { target: "http://localhost:3001", changeOrigin: false } },
  },
  test: {
    // Sunucu testleri gömülü PostgreSQL başlattığı için sırayla
    fileParallelism: false,
  },
} as import("vite").UserConfig);
