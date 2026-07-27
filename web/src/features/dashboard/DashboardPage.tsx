import { motion } from "motion/react"
import { CalendarDaysIcon, FingerprintIcon, LogOutIcon, RefreshCwIcon, ShieldCheckIcon, TimerIcon } from "lucide-react"
import { useState } from "react"
import { BrandMark, BrandWordmark } from "@/components/BrandMark"
import { CopyButton } from "@/components/CopyButton"
import { GlassPanel } from "@/components/GlassPanel"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/auth-context"
import { useNow } from "@/hooks/use-now"
import { formatCountdown, formatDateTime, formatRelative, initials } from "@/lib/format"
import { jwtExpiresAt } from "@/lib/jwt"
import { cn } from "@/lib/utils"
import { DetailTile } from "./DetailTile"

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } }
}

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } } }

export function DashboardPage() {
  const auth = useAuth()
  const now = useNow()
  const [showRaw, setShowRaw] = useState(false)

  const user = auth.user
  const expiresAt = auth.token === null ? null : jwtExpiresAt(auth.token)

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-5 py-8 sm:px-8 sm:py-12">
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <BrandMark size={38} />
          <BrandWordmark />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="glass"
            size="sm"
            onClick={auth.refresh}
            className="gap-2"
            aria-label="Refresh profile from the API"
          >
            <RefreshCwIcon className={cn("size-3.5", auth.isVerifying && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="glass" size="sm" onClick={auth.signOut} className="gap-2">
            <LogOutIcon className="size-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </motion.header>

      <motion.div variants={stagger} initial="hidden" animate="visible" className="mt-10 space-y-6">
        {/* Identity card. */}
        <motion.div variants={fadeUp}>
          <GlassPanel className="p-6 sm:p-8">
            {user === null ? (
              <ProfileSkeleton />
            ) : (
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-5">
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
                  >
                    <Avatar className="size-16 shadow-[0_16px_40px_-16px_color-mix(in_oklab,var(--iris)_90%,transparent)]">
                      <AvatarFallback className="text-xl">{initials(user.username)}</AvatarFallback>
                    </Avatar>
                  </motion.div>

                  <div>
                    <p className="text-[13px] text-muted-foreground">Signed in as</p>
                    <h1 className="mt-0.5 text-3xl leading-tight font-semibold tracking-tight">{user.username}</h1>
                  </div>
                </div>

                <div className="inline-flex items-center gap-2 self-start rounded-full glass-subtle px-3.5 py-2 text-[12px] text-muted-foreground sm:self-auto">
                  <span className="relative grid size-2 place-items-center">
                    <span className="absolute size-2 animate-pulse-ring rounded-full bg-emerald-400" />
                    <span className="size-2 rounded-full bg-emerald-400" />
                  </span>
                  Session active
                </div>
              </div>
            )}
          </GlassPanel>
        </motion.div>

        {/* The actual `/users/me` payload, field by field. */}
        <motion.section variants={fadeUp}>
          <h2 className="mb-3 px-1 text-[11px] font-medium tracking-[0.12em] text-muted-foreground/70 uppercase">
            Account details
          </h2>

          {user === null ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-[92px]" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailTile
                icon={FingerprintIcon}
                label="User ID"
                value={<span className="font-mono text-[13px] break-all">{user.id}</span>}
                hint="UUID v4, assigned at registration"
                action={<CopyButton value={user.id} label="Copy user ID" />}
              />
              <DetailTile
                icon={CalendarDaysIcon}
                label="Member since"
                value={formatDateTime(user.createdAt)}
                hint={formatRelative(user.createdAt)}
              />
              <DetailTile
                icon={TimerIcon}
                label="Session expires"
                value={
                  expiresAt === null ? (
                    "Unknown"
                  ) : (
                    <span className="tabular-nums">{formatCountdown(expiresAt.getTime() - now)}</span>
                  )
                }
                hint={expiresAt === null ? "Token could not be read" : formatDateTime(expiresAt)}
              />
              <DetailTile
                icon={ShieldCheckIcon}
                label="Authentication"
                value="Bearer JWT"
                hint="HS256, verified by the API on every request"
              />
            </div>
          )}
        </motion.section>

        {/* Escape hatch for anyone who wants to see the untouched response. */}
        {user !== null ? (
          <motion.section variants={fadeUp}>
            <button
              type="button"
              onClick={() => setShowRaw((current) => !current)}
              aria-expanded={showRaw}
              className="px-1 text-[12px] text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none"
            >
              {showRaw ? "Hide" : "Show"} raw <code className="font-mono">GET /users/me</code> response
            </button>

            <motion.div
              initial={false}
              animate={{ height: showRaw ? "auto" : 0, opacity: showRaw ? 1 : 0 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <pre className="mt-3 overflow-x-auto rounded-xl glass-subtle p-4 font-mono text-[12px] leading-relaxed text-foreground/80">
                {JSON.stringify(user, null, 2)}
              </pre>
            </motion.div>
          </motion.section>
        ) : null}

        {auth.error !== null ? (
          <motion.p variants={fadeUp} className="px-1 text-[13px] text-destructive/90">
            Couldn’t refresh your profile: {auth.error.message}
          </motion.p>
        ) : null}
      </motion.div>

      <footer className="mt-auto pt-12 text-center text-[11px] text-muted-foreground/60">
        planq · data served live from the Effect API
      </footer>
    </main>
  )
}

function ProfileSkeleton() {
  return (
    <div className="flex items-center gap-5">
      <Skeleton className="size-16 rounded-2xl" />
      <div className="space-y-2.5">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-7 w-44" />
      </div>
    </div>
  )
}
