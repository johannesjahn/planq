import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * Live `/health` indicator. Mostly a courtesy during development: when the backend
 * isn't running, this says so up front instead of letting the first sign-in
 * attempt fail mysteriously.
 */
export function ApiStatusPill({ className }: { className?: string }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    retry: false,
    refetchInterval: 30_000,
    staleTime: 15_000
  })

  const state = isPending ? "checking" : isError || data?.status !== "ok" ? "down" : "up"

  const copy = {
    checking: "Checking API…",
    up: "API online",
    down: "API unreachable"
  }[state]

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full glass-subtle px-3 py-1.5 text-[12px] text-muted-foreground",
        className
      )}
    >
      <span className="relative grid size-2 place-items-center">
        <span
          className={cn(
            "absolute size-2 rounded-full",
            state === "up" && "animate-pulse-ring bg-emerald-400",
            state === "checking" && "bg-amber-300",
            state === "down" && "bg-destructive"
          )}
        />
        <span
          className={cn(
            "size-2 rounded-full",
            state === "up" && "bg-emerald-400",
            state === "checking" && "bg-amber-300",
            state === "down" && "bg-destructive"
          )}
        />
      </span>
      {copy}
    </div>
  )
}
