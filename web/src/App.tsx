import { RouterProvider } from "@tanstack/react-router"
import { useEffect } from "react"
import { useAuth } from "@/features/auth/auth-context"
import { router } from "@/router"

export function App() {
  const auth = useAuth()

  /*
   * Route guards read auth off the router context, which is only sampled when a
   * match is evaluated. Invalidating on sign-in/sign-out re-runs `beforeLoad` for
   * the matches already on screen, so signing out of the dashboard bounces to
   * `/login` without the page having to navigate by hand.
   */
  useEffect(() => {
    void router.invalidate()
  }, [auth.isAuthenticated])

  return <RouterProvider router={router} context={{ auth }} />
}
