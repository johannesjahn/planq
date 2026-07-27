import { motion } from "motion/react"
import { passwordStrength } from "./schemas"

const labels = ["", "Weak", "Fair", "Good", "Strong"] as const
const colors = [
  "transparent",
  "var(--destructive)",
  "oklch(0.78 0.15 70)",
  "oklch(0.8 0.15 150)",
  "oklch(0.82 0.16 160)"
] as const

/**
 * Four segments that fill as the password improves. Purely advisory — the only
 * hard requirement is the eight-character minimum the API enforces — so it never
 * blocks submission, it just tells the truth about what was typed.
 */
export function PasswordStrength({ value }: { value: string }) {
  const score = passwordStrength(value)
  const label = labels[score]

  return (
    <div aria-live="polite" className="pt-1">
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4].map((segment) => (
          <span key={segment} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <motion.span
              className="block h-full origin-left rounded-full"
              initial={false}
              animate={{
                scaleX: score >= segment ? 1 : 0,
                backgroundColor: colors[score] ?? "transparent"
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </span>
        ))}
      </div>
      <motion.p
        key={label}
        initial={{ opacity: 0, y: -2 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-1.5 text-[11px] text-muted-foreground/80"
      >
        {value.length === 0 ? "At least 8 characters." : `Strength: ${label}`}
      </motion.p>
    </div>
  )
}
