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
import { SecurityHeadersLive } from "./SecurityHeaders.ts"
import { UsersLive } from "./UsersLive.ts"

export const ApiLive = HttpApiBuilder.api(Api).pipe(
  // Two api-level middlewares rather than `HttpApiMiddleware.Tag`s: the body cap
  // has to swap the request downstream and the header pass has to touch the
  // response, neither of which a tag-based middleware can do. Living here (not
  // in `Server.ts`) means the tests exercise the same wiring production runs —
  // including the `/docs` route, which `HttpApiSwagger` mounts on this router.
  //
  // Order matters and is not incidental. `HttpApiBuilder.middleware` wraps each
  // layer around the ones built before it, so the last one built ends up
  // outermost; the `Layer.provide` below is what pins that build order (the
  // inner layer outputs nothing — it is sequencing, not a dependency). The
  // header pass has to be outermost because it registers a pre-response handler
  // and then returns: run it inside the body cap and the 413 short-circuits
  // before the handler is ever registered, so that one response would go out
  // bare.
  Layer.provide(SecurityHeadersLive.pipe(Layer.provide(BodyLimitLive))),
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
