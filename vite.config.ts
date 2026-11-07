import { defineConfig } from "vite";

// Tauri 開発時は固定ポートが必要（tauri.conf.json の devUrl と一致させる）
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    target: "es2022",
    sourcemap: false,
    outDir: "dist",
  },
});
