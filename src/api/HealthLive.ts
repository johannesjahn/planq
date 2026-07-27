import { HttpApiBuilder } from "@effect/platform"
import { Effect } from "effect"
import { Api } from "./Api.ts"

export const HealthLive = HttpApiBuilder.group(Api, "health", (handlers) =>
  handlers.handle("health", () => Effect.succeed({ status: "ok" as const }))
)
