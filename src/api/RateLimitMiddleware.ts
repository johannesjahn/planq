import { HttpApiMiddleware, HttpServerRequest } from "@effect/platform"
import { Config, Effect, Layer, Option } from "effect"
import { TooManyRequests } from "../domain/RateLimit.ts"
import { RateLimiter, type RateLimitedRoute } from "./RateLimiter.ts"

export class LoginRateLimit extends HttpApiMiddleware.Tag<LoginRateLimit>()("LoginRateLimit", {
  failure: TooManyRequests
}) {}

export class RegisterRateLimit extends HttpApiMiddleware.Tag<RegisterRateLimit>()("RegisterRateLimit", {
  failure: TooManyRequests
}) {}

/**
 * `X-Forwarded-For` is attacker-controlled unless something in front of us
 * overwrites it, and trusting it blindly would hand out a fresh rate-limit
 * bucket per forged header value. So it is only read when `TRUST_PROXY` says a
 * proxy is in front; otherwise the socket address is the only honest answer.
 */
const clientIp = (request: HttpServerRequest.HttpServerRequest, trustProxy: boolean): string => {
  if (trustProxy) {
    const forwarded = request.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    if (forwarded !== undefined && forwarded.length > 0) return forwarded
  }
  // A request with no socket address (the in-memory web handler used by the
  // tests) all shares one bucket, which is the conservative direction.
  return Option.getOrElse(request.remoteAddress, () => "unknown")
}

// Like `AuthorizationLive`, the per-request effect is built inside the layer:
// an `HttpApiMiddleware` implementation is pinned to `HttpRouter.Provided`, so
// it cannot resolve `RateLimiter` itself and has to close over it instead.
const make = (route: RateLimitedRoute) =>
  Effect.gen(function* () {
    const limiter = yield* RateLimiter
    const trustProxy = yield* Config.boolean("TRUST_PROXY").pipe(Config.withDefault(false))

    return Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      yield* limiter.consume(route, clientIp(request, trustProxy))
    })
  })

export const RateLimitLive = Layer.mergeAll(
  Layer.effect(LoginRateLimit, make("login")),
  Layer.effect(RegisterRateLimit, make("register"))
)
