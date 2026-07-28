import { HttpApiBuilder } from "@effect/platform"
import { Layer } from "effect"
import { JwtConfigLive } from "../domain/Auth.ts"
import { Api } from "./Api.ts"
import { AuthLive } from "./AuthLive.ts"
import { AuthorizationLive } from "./AuthMiddleware.ts"
import { HealthLive } from "./HealthLive.ts"
import { RateLimitLive } from "./RateLimitMiddleware.ts"
import { RateLimiterLive } from "./RateLimiter.ts"
import { UsersLive } from "./UsersLive.ts"

export const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(AuthLive),
  Layer.provide(UsersLive),
  Layer.provide(HealthLive),
  Layer.provide(AuthorizationLive),
  Layer.provide(RateLimitLive),
  Layer.provide(JwtConfigLive),
  // Provided last so the single limiter instance is shared by the middleware
  // (per-IP windows) and the login handler (per-username lockout).
  Layer.provide(RateLimiterLive)
)
