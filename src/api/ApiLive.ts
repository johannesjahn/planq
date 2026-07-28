import { HttpApiBuilder } from "@effect/platform"
import { Layer } from "effect"
import { JwtConfigLive } from "../domain/Auth.ts"
import { Api } from "./Api.ts"
import { AuthLive } from "./AuthLive.ts"
import { AuthorizationLive } from "./AuthMiddleware.ts"
import { BodyLimitLive } from "./BodyLimit.ts"
import { HealthLive } from "./HealthLive.ts"
import { RateLimitLive } from "./RateLimitMiddleware.ts"
import { RateLimiterLive } from "./RateLimiter.ts"
import { UsersLive } from "./UsersLive.ts"

export const ApiLive = HttpApiBuilder.api(Api).pipe(
  // An api-level middleware rather than an `HttpApiMiddleware.Tag`: it has to
  // cap the body *and* swap the request downstream, which a tag-based
  // middleware can't do. Living here (not in `Server.ts`) means the tests
  // exercise the same wiring production runs.
  Layer.provide(BodyLimitLive),
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
