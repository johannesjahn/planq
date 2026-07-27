import type * as React from "react"
import { cn } from "@/lib/utils"

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-lg bg-white/8", className)}
      {...props}
      // The sweep reads as "loading" without the jitter of an opacity pulse.
    >
      <span className="absolute inset-0 -translate-x-full animate-shimmer bg-linear-to-r from-transparent via-white/12 to-transparent" />
    </div>
  )
}
