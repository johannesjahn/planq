import type * as React from "react"
import { cn } from "@/lib/utils"

export function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "peer h-11 w-full rounded-lg border border-white/12 bg-white/6 px-3.5 text-sm text-foreground shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset] backdrop-blur-md transition-all duration-200 outline-none",
        "placeholder:text-muted-foreground/60",
        "hover:border-white/20 hover:bg-white/8",
        "focus:border-transparent focus:bg-white/10 focus:ring-2 focus:ring-ring/70",
        "aria-invalid:border-destructive/60 aria-invalid:focus:ring-destructive/50",
        "disabled:cursor-not-allowed disabled:opacity-55",
        className
      )}
      {...props}
    />
  )
}
