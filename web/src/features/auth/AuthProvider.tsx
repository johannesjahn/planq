import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { ApiError, api, setAuthToken, type AuthResponse } from "@/lib/api"
import { AuthContext, type AuthContextValue } from "./auth-context"
import { clearSession, readSession, writeSession } from "./session-storage"

const initialSession = readSession()

// Primed before the first render so the very first request already carries the
// bearer header — otherwise a `/users/me` fired during mount would race the effect
// that sets the token.
setAuthToken(initialSession?.token ?? null)

const meQueryKey = ["users", "me"] as const

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(initialSession?.token ?? null)

  /*
   * The stored user is only a cache: it seeds the UI so a reload paints instantly,
   * while `/users/me` re-validates the token in the background. If the token is
   * stale the query 401s and the session is dropped.
   */
  const meQuery = useQuery({
    queryKey: meQueryKey,
    queryFn: api.me,
    enabled: token !== null,
    initialData: initialSession?.user,
    retry: (failureCount, error) => !(error instanceof ApiError && error.isUnauthorized) && failureCount < 2,
    staleTime: 30_000
  })

  const signIn = useCallback(
    (response: AuthResponse) => {
      writeSession({ token: response.token, user: response.user })
      setAuthToken(response.token)
      setToken(response.token)
      queryClient.setQueryData(meQueryKey, response.user)
    },
    [queryClient]
  )

  const signOut = useCallback(() => {
    clearSession()
    setAuthToken(null)
    setToken(null)
    queryClient.removeQueries({ queryKey: meQueryKey })
  }, [queryClient])

  // A rejected token means the session is over, wherever the rejection came from —
  // an expired JWT, a revoked account, a restarted server with a new secret. The
  // 401 originates outside React, so tearing the session down in response to it is
  // exactly the external-synchronisation case effects exist for, even though the
  // compiler lint flags the `setState` inside.
  const error = meQuery.error
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see comment above
    if (error instanceof ApiError && error.isUnauthorized) signOut()
  }, [error, signOut])

  const value = useMemo<AuthContextValue>(() => {
    const user = token === null ? null : (meQuery.data ?? null)
    return {
      user,
      token,
      isAuthenticated: token !== null,
      isVerifying: token !== null && meQuery.isPending,
      error: error instanceof ApiError && error.isUnauthorized ? null : (error ?? null),
      signIn,
      signOut,
      refresh: () => void queryClient.invalidateQueries({ queryKey: meQueryKey })
    }
  }, [token, meQuery.data, meQuery.isPending, error, signIn, signOut, queryClient])

  return <AuthContext value={value}>{children}</AuthContext>
}
