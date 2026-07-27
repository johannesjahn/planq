import { Outlet } from "@tanstack/react-router"
import { motion } from "motion/react"
import { KeyRoundIcon, ShieldCheckIcon, ZapIcon } from "lucide-react"
import { ApiStatusPill } from "@/components/ApiStatusPill"
import { BrandMark, BrandWordmark } from "@/components/BrandMark"
import { GlassPanel } from "@/components/GlassPanel"
import { AuthTabs } from "./AuthTabs"

const highlights = [
  {
    icon: ShieldCheckIcon,
    title: "Argon2id by default",
    body: "Passwords are hashed with argon2id — never stored, never logged, never recoverable."
  },
  {
    icon: KeyRoundIcon,
    title: "Short-lived tokens",
    body: "Sessions are signed JWTs that expire after two hours and re-validate on every load."
  },
  {
    icon: ZapIcon,
    title: "Typed end to end",
    body: "This client is generated from the API's own OpenAPI document, so the contract can't drift."
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

          <h1 className="max-w-xl text-balance text-5xl leading-[1.05] font-semibold tracking-tight xl:text-6xl">
            Plan quietly.
            <br />
            <span className="text-gradient">Ship loudly.</span>
          </h1>

          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            A deliberately small workspace for the work that actually matters. Create an account and pick up exactly
            where you left off.
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
            By continuing you agree to keep your credentials to yourself.
          </p>
        </motion.div>
      </div>
    </main>
  )
}
