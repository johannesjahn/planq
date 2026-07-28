import { motion } from "motion/react"
import { cn } from "@/lib/utils"

/**
 * The planq mark: a glass tile holding a "q" drawn as a ring plus a tail, with a
 * conic gradient sweeping behind it. The sweep is what makes the logo feel lit
 * from within rather than printed on.
 */
export function BrandMark({ className, size = 44 }: { className?: string; size?: number }) {
  return (
    <div
      className={cn("relative grid shrink-0 place-items-center rounded-xl glass-subtle", className)}
      style={{ width: size, height: size }}
    >
      <div
        aria-hidden
        className="absolute inset-0 animate-spin-slow rounded-xl opacity-70 blur-[6px]"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0%, color-mix(in oklab, var(--azure) 95%, transparent) 25%, transparent 45%, color-mix(in oklab, var(--teal) 90%, transparent) 70%, transparent 90%)"
        }}
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="relative size-1/2 text-white"
        role="img"
        aria-label="planq"
        strokeLinecap="round"
      >
        {/* Bowl and descender of a lowercase "q" — drawn, not typeset, so the two
            strokes can be animated on independently. */}
        <motion.circle
          cx="9.5"
          cy="10"
          r="6"
          stroke="currentColor"
          strokeWidth="2.3"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: "easeInOut" }}
        />
        <motion.path
          d="M15.5 10 V21"
          stroke="currentColor"
          strokeWidth="2.3"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.85, ease: "easeOut" }}
        />
      </svg>
    </div>
  )
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-lg font-semibold tracking-tight text-foreground", className)}>
      plan<span className="text-gradient">q</span>
    </span>
  )
}
