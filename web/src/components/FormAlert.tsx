import { AlertCircleIcon } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

/**
 * Server-side failure banner for a form (bad credentials, taken username, …).
 *
 * It slides open and gives one short shake on arrival: enough to pull the eye back
 * to the top of the form after a failed submit without resorting to a toast.
 */
export function FormAlert({ message }: { message: string | null }) {
  return (
    <AnimatePresence initial={false} mode="wait">
      {message !== null ? (
        <motion.div
          key={message}
          role="alert"
          aria-live="assertive"
          initial={{ opacity: 0, height: 0, marginBottom: 0 }}
          animate={{ opacity: 1, height: "auto", marginBottom: 20, x: [0, -6, 5, -3, 0] }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          transition={{
            height: { duration: 0.22, ease: "easeOut" },
            opacity: { duration: 0.22 },
            x: { duration: 0.42, delay: 0.08 }
          }}
          className="overflow-hidden"
        >
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/35 bg-destructive/12 px-3.5 py-3 text-[13px] text-foreground/90 backdrop-blur-md">
            <AlertCircleIcon className="mt-px size-4 shrink-0 text-destructive" />
            <p>{message}</p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
