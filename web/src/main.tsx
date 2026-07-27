import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "@/App"
import { AuthProvider } from "@/features/auth/AuthProvider"
import { ApiError } from "@/lib/api"
import "./index.css"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retrying a 401 or a 409 just delays the error the user needs to see.
      retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      refetchOnWindowFocus: false
    },
    mutations: { retry: false }
  }
})

const rootElement = document.getElementById("root")
if (rootElement === null) throw new Error("Missing #root element")

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
)
