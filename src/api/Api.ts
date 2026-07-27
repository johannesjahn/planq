import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { Schema } from "effect"
import {
  AuthResponse,
  UsernameAlreadyInUse,
  InvalidCredentials,
  LoginPayload,
  RegisterPayload,
  User
} from "../domain/User.ts"
import { Authorization } from "./AuthMiddleware.ts"

export class HealthGroup extends HttpApiGroup.make("health").add(
  HttpApiEndpoint.get("health", "/health").addSuccess(Schema.Struct({ status: Schema.Literal("ok") }))
) {}

export class AuthGroup extends HttpApiGroup.make("auth")
  .add(
    HttpApiEndpoint.post("register", "/auth/register")
      .setPayload(RegisterPayload)
      .addSuccess(AuthResponse, { status: 201 })
      .addError(UsernameAlreadyInUse)
  )
  .add(
    HttpApiEndpoint.post("login", "/auth/login")
      .setPayload(LoginPayload)
      .addSuccess(AuthResponse)
      .addError(InvalidCredentials)
  ) {}

export class UsersGroup extends HttpApiGroup.make("users")
  .add(HttpApiEndpoint.get("me", "/users/me").addSuccess(User))
  .middleware(Authorization) {}

export class Api extends HttpApi.make("api").add(HealthGroup).add(AuthGroup).add(UsersGroup) {}
