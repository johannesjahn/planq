import { Link, useRouterState } from "@tanstack/react-router"
import { motion } from "motion/react"

const tabs = [
  { to: "/login", label: "Sign in" },
  { to: "/register", label: "Create account" }
] as const

/**
 * Segmented control linking the two auth routes. The highlight is a single element
 * shared across both tabs via `layoutId`, so switching routes slides it instead of
 * cross-fading — the layout route keeps this component mounted, which is what
 * makes the shared-element transition possible.
 */
export function AuthTabs() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <div className="relative grid grid-cols-2 gap-1 rounded-xl glass-subtle p-1" role="tablist">
      {tabs.map((tab) => {
        const active = pathname === tab.to
        return (
          <Link
            key={tab.to}
            to={tab.to}
            role="tab"
            aria-selected={active}
            className="relative z-10 rounded-lg px-3 py-2 text-center text-[13px] font-medium transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            {active ? (
              <motion.span
                layoutId="auth-tab-pill"
                className="absolute inset-0 -z-10 rounded-lg bg-white/12 shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className={active ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"}>
              {tab.label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
