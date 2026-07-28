import { Loader2Icon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Primary form action. A light sweeps across it on hover, and the label
 * cross-fades with a spinner while the request is in flight — the button keeps its
 * width throughout so the card never reflows mid-submit.
 */
export function SubmitButton({
  pending,
  pendingLabel = "Just a moment…",
  children,
  className,
  ...props
}: {
  pending: boolean
  pendingLabel?: string
  children: ReactNode
} & React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      className={cn("group relative w-full overflow-hidden", className)}
      {...props}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 -left-full w-1/2 skew-x-12 bg-white/25 blur-md transition-all duration-700 group-hover:left-[150%]"
      />
      <AnimatePresence initial={false} mode="wait">
        {pending ? (
          <motion.span
            key="pending"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-2"
          >
            <Loader2Icon className="size-4 animate-spin" />
            {pendingLabel}
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="inline-flex items-center gap-2"
          >
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  )
}
