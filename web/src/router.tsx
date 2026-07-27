import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  ScrollRestoration
} from "@tanstack/react-router"
import { AuroraBackground } from "@/components/AuroraBackground"
import { NotFoundPage } from "@/components/NotFoundPage"
import { AuthLayout } from "@/features/auth/AuthLayout"
import { LoginForm } from "@/features/auth/LoginForm"
import { RegisterForm } from "@/features/auth/RegisterForm"
import type { AuthContextValue } from "@/features/auth/auth-context"
import { DashboardPage } from "@/features/dashboard/DashboardPage"

export type RouterContext = {
  auth: AuthContextValue
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <AuroraBackground />
      <ScrollRestoration />
      <Outlet />
    </>
  ),
  notFoundComponent: NotFoundPage
})

/*
 * Pathless layout route. `/login` and `/register` are siblings underneath it, so
 * navigating between them swaps only the form — the card, the tabs and the sliding
 * tab highlight stay mounted.
 */
const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_auth",
  component: AuthLayout,
  beforeLoad: ({ context }) => {
    // Someone already signed in has no business on the sign-in screen.
    if (context.auth.isAuthenticated) {
      throw redirect({ to: "/" })
    }
  }
})

const loginRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/login",
  // `redirect` carries the page the guard bounced the visitor away from.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search["redirect"] === "string" ? search["redirect"] : undefined
  }),
  component: function LoginRoute() {
    const { redirect: redirectTo } = loginRoute.useSearch()
    return <LoginForm redirectTo={redirectTo} />
  }
})

const registerRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: "/register",
  component: RegisterForm
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: "/login", search: { redirect: location.href } })
    }
  }
})

const routeTree = rootRoute.addChildren([authLayoutRoute.addChildren([loginRoute, registerRoute]), dashboardRoute])

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  // Filled in by <RouterProvider context={{ auth }} /> — the value only exists
  // inside React, so the router is created without it.
  context: { auth: undefined as unknown as AuthContextValue }
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
