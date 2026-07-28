import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"
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

export class HealthGroup extends HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("health", "/health").addSuccess(Schema.Struct({ status: Schema.Literal("ok") }))
) {}

export class AuthGroup extends HttpApiGroup.make("auth")
  .add(
    HttpApiEndpoint.post("register", "/auth/register")
      .setPayload(RegisterPayload)
      .addSuccess(AuthResponse, { status: 201 })
      .addError(UsernameAlreadyInUse)
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
      .middleware(LoginRateLimit)
  ) {}

export class UsersGroup extends HttpApiGroup.make("users")
  .add(HttpApiEndpoint.get("me", "/users/me").addSuccess(User))
  .middleware(Authorization) {}

export class Api extends HttpApi.make("api").add(HealthGroup).add(AuthGroup).add(UsersGroup) {}
