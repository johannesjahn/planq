import { Database as BunSqliteDatabase } from "bun:sqlite"
import { afterAll, describe, expect, test } from "bun:test"
import { HttpApiBuilder } from "@effect/platform"
import { BunHttpServer } from "@effect/platform-bun"
import { drizzle } from "drizzle-orm/bun-sqlite"
import { ConfigProvider, Layer, Logger } from "effect"
import { ApiLive } from "../src/api/ApiLive.ts"
import { Db, DatabaseLive } from "../src/db/Database.ts"
import * as schema from "../src/db/schema.ts"

// Pinned through a ConfigProvider rather than `process.env` — test files share a
// process, so a module-scope env write would reconfigure whichever file bun runs
// next. The `orElse` keeps JWT_SECRET and friends resolving from the environment.
const TestConfig = Layer.setConfigProvider(
  ConfigProvider.fromMap(
    new Map([
      ["DB_FILENAME", ":memory:"],
      ["RATE_LIMIT_ENABLED", "false"]
    ])
  ).pipe(ConfigProvider.orElse(() => ConfigProvider.fromEnv()))
)

const webHandler = <E>(database: Layer.Layer<Db, E>) =>
  HttpApiBuilder.toWebHandler(
    Layer.merge(ApiLive.pipe(Layer.provide(database)), BunHttpServer.layerContext).pipe(
      Layer.provide(TestConfig),
      // The readiness handler logs the DB failure it swallows; that is deliberate
      // (the response body carries no detail) but it would spam the test output.
      Layer.provide(Logger.replace(Logger.defaultLogger, Logger.none))
    )
  )

// A connection that is open but has never had a migration run against it, so
// `users` does not exist. This is the shape of every failure the readiness probe
// is meant to catch — a detached or read-only volume, a corrupt file, a database
// the process cannot read — reproduced deterministically.
const UnmigratedDatabase = Layer.sync(Db, () => drizzle(new BunSqliteDatabase(":memory:"), { schema }))

const healthy = webHandler(DatabaseLive)
const broken = webHandler(UnmigratedDatabase)

afterAll(async () => {
  await Promise.all([healthy.dispose(), broken.dispose()])
})

describe("GET /health (liveness)", () => {
  test("reports ok when the database is usable", async () => {
    const response = await healthy.handler(new Request("http://localhost/health"))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: "ok" })
  })

  // The point of keeping liveness shallow: a broken dependency must not make the
  // process look dead, because restarting it would not fix the dependency.
  test("still reports ok when the database is not usable", async () => {
    const response = await broken.handler(new Request("http://localhost/health"))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: "ok" })
  })
})

describe("GET /ready (readiness)", () => {
  test("reports ok when the database answers", async () => {
    const response = await healthy.handler(new Request("http://localhost/ready"))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: "ok" })
  })

  // This is the regression the endpoint exists for: before the split, this same
  // container reported healthy while /auth/* and /users/me all returned 500.
  test("reports 503 when the database cannot be queried", async () => {
    const response = await broken.handler(new Request("http://localhost/ready"))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ _tag: "ServiceUnavailable", check: "database" })
  })

  test("agrees with what the endpoints that use the database do", async () => {
    const register = await broken.handler(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "nurseamy", password: "supersecret" })
      })
    )
    expect(register.status).toBe(500)

    const ready = await broken.handler(new Request("http://localhost/ready"))
    expect(ready.status).toBe(503)
  })

  // A 503 is a domain error raised inside the handler, so it leaves the app
  // through the failure channel — the same path that used to lose the security
  // headers before they moved to a pre-response handler.
  test("carries the security response headers", async () => {
    const response = await broken.handler(new Request("http://localhost/ready"))
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    )
  })
})
