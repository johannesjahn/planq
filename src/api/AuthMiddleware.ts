import { HttpApiMiddleware, HttpApiSecurity } from "@effect/platform"
import { Effect, Layer, Redacted } from "effect"
import { CurrentUser, JwtConfig, verifyToken } from "../domain/Auth.ts"
import { Unauthorized } from "../domain/User.ts"

export class Authorization extends HttpApiMiddleware.Tag<Authorization>()("Authorization", {
  failure: Unauthorized,
  provides: CurrentUser,
  security: {
    bearer: HttpApiSecurity.bearer
  }
}) {}

// JwtConfig is resolved once, at layer-build time, and closed over below —
// the per-request `bearer` handler must not require any further context.
export const AuthorizationLive = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const jwtConfig = yield* JwtConfig
    return Authorization.of({
      bearer: (bearerToken) =>
        verifyToken(Redacted.value(bearerToken)).pipe(
          Effect.provideService(JwtConfig, jwtConfig),
          Effect.mapError(() => new Unauthorized())
        )
    })
  })
)
