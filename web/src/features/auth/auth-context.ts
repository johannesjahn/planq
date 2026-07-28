import { createContext, use } from "react"
import type { AuthResponse, User } from "@/lib/api"

export type AuthContextValue = {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  /** True while the stored token is being re-validated against `/users/me` on boot. */
  isVerifying: boolean
  /** Set when the profile request failed for a reason other than an expired session. */
  error: Error | null
  signIn: (response: AuthResponse) => void
  signOut: () => void
  refresh: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = use(AuthContext)
  if (value === null) throw new Error("useAuth must be used inside <AuthProvider>")
  return value
}
