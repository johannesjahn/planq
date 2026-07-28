import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    port: 5173,
    // Proxy keeps the browser on a single origin during development, so cookies,
    // relative URLs and CORS all behave the same as they would behind a reverse
    // proxy in production. Override the backend location with `VITE_PROXY_TARGET`.
    proxy: {
      "/api": {
        target: process.env["VITE_PROXY_TARGET"] ?? "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      }
    }
  }
})
