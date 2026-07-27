import { CheckIcon, CopyIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/** Copy-to-clipboard control whose icon flips to a checkmark for two seconds. */
export function CopyButton({
  value,
  label = "Copy",
  className
}: {
  value: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  return (
    <button
      type="button"
      aria-label={copied ? "Copied" : label}
      onClick={() => {
        void navigator.clipboard.writeText(value).then(
          () => setCopied(true),
          () => setCopied(false)
        )
      }}
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground/70 transition-colors hover:bg-white/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none",
        className
      )}
    >
      <AnimatePresence initial={false} mode="wait">
        {copied ? (
          <motion.span
            key="copied"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
          >
            <CheckIcon className="size-4 text-emerald-400" />
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
          >
            <CopyIcon className="size-4" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}
