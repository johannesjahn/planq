import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { PayloadTooLarge } from "../domain/BodyLimit.ts"
import { HealthStatus, ServiceUnavailable } from "../domain/Health.ts"
import { TooManyRequests } from "../domain/RateLimit.ts"
import {
  AuthResponse,
  UsernameAlreadyInUse,
  InvalidCredentials,
  LoginPayload,
  RegisterPayload,
  User
} from "../domain/User.ts"
import { Authorization } from "./AuthMiddleware.ts"
import { LoginRateLimit, RegisterRateLimit } from "./RateLimitMiddleware.ts"

// Two probes, because they answer different questions and a caller acts on them
// differently. `/health` is liveness: it touches nothing, so a `200` means only
// that the process is up and serving — the one failure a restart actually fixes.
// `/ready` is readiness: it round-trips the database, so a `503` means the API
// is running but cannot serve `/auth/*` or `/users/me`. Restarting the process
// won't remount a detached volume, so a `503` here should drain traffic and page
// someone, not spin the container. See `src/api/HealthLive.ts` and the
// `HEALTHCHECK` comment in the `Dockerfile`.
export class HealthGroup extends HttpApiGroup.make("health")
  .add(HttpApiEndpoint.get("health", "/health").addSuccess(HealthStatus))
  .add(HttpApiEndpoint.get("ready", "/ready").addSuccess(HealthStatus).addError(ServiceUnavailable)) {}

// `PayloadTooLarge` is declared on the two endpoints that take a body so it
// shows up in the OpenAPI document (and therefore in the generated frontend
// client). It is raised by the api-level middleware in `./BodyLimit.ts`, before
// any handler runs, which is the whole point — see that file.
export class AuthGroup extends HttpApiGroup.make("auth")
  .add(
    HttpApiEndpoint.post("register", "/auth/register")
      .setPayload(RegisterPayload)
      .addSuccess(AuthResponse, { status: 201 })
      .addError(UsernameAlreadyInUse)
      .addError(PayloadTooLarge)
      .middleware(RegisterRateLimit)
  )
  .add(
    // `TooManyRequests` is declared here as well as on the middleware: the
    // middleware raises it for the per-IP window, the handler raises it for the
    // per-username lockout (which needs the decoded payload).
    HttpApiEndpoint.post("login", "/auth/login")
      .setPayload(LoginPayload)
      .addSuccess(AuthResponse)
      .addError(InvalidCredentials)
      .addError(TooManyRequests)
      .addError(PayloadTooLarge)
      .middleware(LoginRateLimit)
  ) {}

export class UsersGroup extends HttpApiGroup.make("users")
  .add(HttpApiEndpoint.get("me", "/users/me").addSuccess(User))
  .middleware(Authorization) {}

export class Api extends HttpApi.make("api").add(HealthGroup).add(AuthGroup).add(UsersGroup) {}
