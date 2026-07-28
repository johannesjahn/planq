import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath, URL } from "node:url"
import { defineConfig, type Plugin } from "vite"
import { contentSecurityPolicy, contentSecurityPolicyMeta, securityHeaders } from "./security-headers.ts"

/**
 * Inlines the CSP into `index.html`. `dist/` is a folder of static files that
 * some other process serves, so a build that carries its own policy is protected
 * even where nobody has configured response headers — and the same tag in
 * development means a policy that breaks the app fails here rather than silently
 * in production.
 */
const cspMeta = (policy: string): Plugin => ({
  name: "planq-csp-meta",
  transformIndexHtml: () => [
    {
      tag: "meta",
      attrs: { "http-equiv": "Content-Security-Policy", content: contentSecurityPolicyMeta(policy) },
      // Must precede the scripts and styles it governs.
      injectTo: "head-prepend"
    }
  ]
})

export default defineConfig(({ command, isPreview }) => {
  // `vite preview` serves the production build, so it gets the production policy.
  const dev = command === "serve" && isPreview !== true
  const policy = contentSecurityPolicy({ apiBaseUrl: process.env["VITE_API_BASE_URL"], dev })
  const headers = securityHeaders(policy)

  return {
    plugins: [react(), tailwindcss(), cspMeta(policy)],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url))
      }
    },
    server: {
      port: 5173,
      headers,
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
    },
    preview: { headers }
  }
})
