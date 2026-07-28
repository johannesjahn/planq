import { HttpApiBuilder, HttpApiSwagger, HttpMiddleware } from "@effect/platform"
import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { Layer } from "effect"
import { ApiLive } from "./api/ApiLive.ts"
import { DatabaseLive } from "./db/Database.ts"

const port = Number(process.env["PORT"] ?? 3000)

// The `web/` frontend runs on its own origin (Vite dev server on :5173 by default),
// so browsers need explicit CORS headers to talk to this API. `CORS_ORIGINS` is a
// comma-separated allowlist; when unset every origin is allowed, which is fine for
// local development but should be pinned in production.
const corsOrigins = (process.env["CORS_ORIGINS"] ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0)

const cors = HttpMiddleware.cors({
  ...(corsOrigins.length > 0 ? { allowedOrigins: corsOrigins } : {}),
  allowedHeaders: ["Content-Type", "Authorization"],
  allowedMethods: ["GET", "POST", "OPTIONS"]
})

const HttpLive = HttpApiBuilder.serve((app) => HttpMiddleware.logger(cors(app))).pipe(
  Layer.provide(HttpApiSwagger.layer({ path: "/docs" })),
  Layer.provide(ApiLive),
  Layer.provide(DatabaseLive),
  Layer.provide(BunHttpServer.layer({ port }))
)

BunRuntime.runMain(Layer.launch(HttpLive))
