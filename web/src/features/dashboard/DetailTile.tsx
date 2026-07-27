import { motion } from "motion/react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** One labelled fact about the signed-in user, on its own frosted tile. */
export function DetailTile({
  icon: Icon,
  label,
  value,
  hint,
  action,
  className
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  hint?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={cn(
        "group relative overflow-hidden rounded-xl glass-subtle p-4 transition-colors duration-200 hover:border-white/20",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-[11px] font-medium tracking-[0.08em] text-muted-foreground/80 uppercase">
          <Icon className="size-3.5" />
          {label}
        </span>
        {action}
      </div>
      <div className="mt-2.5 text-[15px] leading-snug font-medium break-words text-foreground">{value}</div>
      {hint !== undefined ? <div className="mt-1 text-xs text-muted-foreground/80">{hint}</div> : null}
    </motion.div>
  )
}
