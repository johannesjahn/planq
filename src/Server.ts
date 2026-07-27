import { HttpApiBuilder, HttpApiSwagger, HttpMiddleware } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Layer } from "effect"
import { ApiLive } from "./api/ApiLive.ts"
import { DatabaseLive } from "./db/Database.ts"

const port = Number(process.env["PORT"] ?? 3000)

const HttpLive = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
  Layer.provide(HttpApiSwagger.layer({ path: "/docs" })),
  Layer.provide(ApiLive),
  Layer.provide(DatabaseLive),
  Layer.provide(BunHttpServer.layer({ port }))
)

BunRuntime.runMain(Layer.launch(HttpLive))
