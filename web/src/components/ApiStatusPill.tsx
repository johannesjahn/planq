import { useQuery } from "@tanstack/react-query"
import { ApiError, api } from "@/lib/api"
import { cn } from "@/lib/utils"

/**
 * Live API indicator. Mostly a courtesy during development: when the backend
 * isn't running, this says so up front instead of letting the first sign-in
 * attempt fail mysteriously.
 *
 * It polls `/ready`, not `/health`. `/health` answers `200` as long as the
 * process is listening, including when the database is gone and every sign-in
 * would return a 500 — which is exactly the case this pill should not show
 * green for. A 503 from `/ready` is its own state: the server is there, it just
 * can't serve us.
 */
export function ApiStatusPill({ className }: { className?: string }) {
  const { data, error, isPending, isError } = useQuery({
    queryKey: ["ready"],
    queryFn: api.ready,
    retry: false,
    refetchInterval: 30_000,
    staleTime: 15_000
  })

  const state = isPending
    ? "checking"
    : error instanceof ApiError && error.isUnavailable
      ? "degraded"
      : isError || data?.status !== "ok"
        ? "down"
        : "up"

  const copy = {
    checking: "Checking API…",
    up: "API online",
    degraded: "API degraded",
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
            state === "degraded" && "bg-amber-400",
            state === "down" && "bg-destructive"
          )}
        />
        <span
          className={cn(
            "size-2 rounded-full",
            state === "up" && "bg-emerald-400",
            state === "checking" && "bg-amber-300",
            state === "degraded" && "bg-amber-400",
            state === "down" && "bg-destructive"
          )}
        />
      </span>
      {copy}
    </div>
  )
}
