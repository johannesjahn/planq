import { useEffect, useState } from "react"

/**
 * Re-renders on an interval so time-based labels (countdowns, "3 minutes ago")
 * stay current without every component owning its own timer.
 */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])

  return now
}
