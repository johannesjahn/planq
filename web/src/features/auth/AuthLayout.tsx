import { Outlet } from "@tanstack/react-router"
import { motion } from "motion/react"
import { CalendarClockIcon, ShieldCheckIcon, StethoscopeIcon } from "lucide-react"
import { ApiStatusPill } from "@/components/ApiStatusPill"
import { BrandMark, BrandWordmark } from "@/components/BrandMark"
import { GlassPanel } from "@/components/GlassPanel"
import { AuthTabs } from "./AuthTabs"

const highlights = [
  {
    icon: ShieldCheckIcon,
    title: "Credentials never stored in the clear",
    body: "Passwords are hashed with argon2id — never written down, never logged, never recoverable."
  },
  {
    icon: CalendarClockIcon,
    title: "Built for shared terminals",
    body: "Sessions expire after two hours, so a ward workstation never stays open behind you."
  },
  {
    icon: StethoscopeIcon,
    title: "One account per clinician",
    body: "Every account is a single, uniquely identified person — the record the rota is built on."
  }
]

/**
 * Shell shared by `/login` and `/register`.
 *
 * Keeping both routes under one layout route means the panel, the tabs and the
 * sliding tab highlight stay mounted while navigating between them — the two forms
 * feel like two faces of one card rather than two separate pages.
 */
export function AuthLayout() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center px-5 py-10 sm:px-8">
      <div className="grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_minmax(0,460px)] lg:gap-20">
        {/* Narrative half — hidden on small screens where the form is the whole job. */}
        <motion.section
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:block"
        >
          <div className="mb-9 flex items-center gap-3">
            <BrandMark />
            <BrandWordmark className="text-xl" />
          </div>

          {/* Sized so each sentence holds one line at the narrowest lg breakpoint —
              a three-line ragged headline undercuts the calm the copy is going for. */}
          <h1 className="max-w-2xl text-balance text-[2.4rem] leading-[1.08] font-semibold tracking-tight xl:text-[3.1rem]">
            Every shift covered.
            <br />
            <span className="text-gradient">Every clinician rested.</span>
          </h1>

          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Shift planning for hospitals, clinics and care teams. Build the rota once, and let every clinician see
            exactly where and when they are needed.
          </p>

          <ul className="mt-10 max-w-md space-y-3.5">
            {highlights.map((highlight, index) => (
              <motion.li
                key={highlight.title}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.25 + index * 0.1, ease: "easeOut" }}
                className="flex items-start gap-3.5"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg glass-subtle text-foreground/80">
                  <highlight.icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium">{highlight.title}</span>
                  <span className="block text-[13px] leading-relaxed text-muted-foreground">{highlight.body}</span>
                </span>
              </motion.li>
            ))}
          </ul>

          <ApiStatusPill className="mt-10" />
        </motion.section>

        {/* Form half. */}
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="w-full"
        >
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <BrandMark size={38} />
            <BrandWordmark />
          </div>

          <GlassPanel className="p-6 sm:p-8">
            <AuthTabs />
            <Outlet />
          </GlassPanel>

          <p className="mt-6 px-1 text-center text-xs leading-relaxed text-muted-foreground/70">
            Signing in on a shared ward terminal? Remember to sign out when you step away.
          </p>
        </motion.div>
      </div>
    </main>
  )
}
