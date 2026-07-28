import { Link } from "@tanstack/react-router"
import { motion } from "motion/react"
import { GlassPanel } from "@/components/GlassPanel"
import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <GlassPanel className="max-w-md p-8 text-center">
          <p className="font-mono text-5xl font-semibold text-gradient">404</p>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Nothing scheduled here</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            That page doesn’t exist — or it moved somewhere else.
          </p>
          <Button asChild variant="glass" className="mt-6">
            <Link to="/">Back to your shifts</Link>
          </Button>
        </GlassPanel>
      </motion.div>
    </main>
  )
}
