import { motion, useMotionTemplate, useMotionValue, useReducedMotion } from "motion/react"
import type * as React from "react"
import { cn } from "@/lib/utils"

// `motion.div` widens `children` to accept MotionValues; this surface only ever
// wraps ordinary nodes, so it is narrowed back to ReactNode.
type GlassPanelProps = Omit<React.ComponentProps<typeof motion.div>, "children"> & {
  children?: React.ReactNode
  /** Disables the cursor-tracking highlight (e.g. for small, dense surfaces). */
  spotlight?: boolean
}

/**
 * Frosted surface with a highlight that tracks the pointer.
 *
 * Real glass catches the light as you move past it; a static translucent rectangle
 * doesn't. Tracking the cursor with two motion values (rather than React state)
 * keeps the highlight on the compositor — no re-render per mousemove — and it is
 * switched off entirely for `prefers-reduced-motion` and touch input, where there
 * is no cursor to follow anyway.
 */
export function GlassPanel({ className, children, spotlight = true, ...props }: GlassPanelProps) {
  const reduceMotion = useReducedMotion()
  const mouseX = useMotionValue(-400)
  const mouseY = useMotionValue(-400)

  const highlight = useMotionTemplate`radial-gradient(340px circle at ${mouseX}px ${mouseY}px, color-mix(in oklab, white 14%, transparent), transparent 70%)`

  const enabled = spotlight && !reduceMotion

  return (
    <motion.div
      onPointerMove={
        enabled
          ? (event) => {
              if (event.pointerType === "touch") return
              const bounds = event.currentTarget.getBoundingClientRect()
              mouseX.set(event.clientX - bounds.left)
              mouseY.set(event.clientY - bounds.top)
            }
          : undefined
      }
      onPointerLeave={
        enabled
          ? () => {
              mouseX.set(-400)
              mouseY.set(-400)
            }
          : undefined
      }
      className={cn("glass glass-edge relative overflow-hidden rounded-2xl", className)}
      {...props}
    >
      {enabled ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-0 opacity-70 transition-opacity duration-300"
          style={{ background: highlight }}
        />
      ) : null}
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}
