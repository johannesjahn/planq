import { HttpApiBuilder } from "@effect/platform"
import { Layer } from "effect"
import { JwtConfigLive } from "../domain/Auth.ts"
import { Api } from "./Api.ts"
import { AuthLive } from "./AuthLive.ts"
import { AuthorizationLive } from "./AuthMiddleware.ts"
import { HealthLive } from "./HealthLive.ts"
import { UsersLive } from "./UsersLive.ts"

export const ApiLive = HttpApiBuilder.api(Api).pipe(
  Layer.provide(AuthLive),
  Layer.provide(UsersLive),
  Layer.provide(HealthLive),
  Layer.provide(AuthorizationLive),
  Layer.provide(JwtConfigLive)
)
