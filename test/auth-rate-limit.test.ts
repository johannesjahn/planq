import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { HttpApiBuilder } from "@effect/platform"
import { BunHttpServer } from "@effect/platform-bun"
import { ConfigProvider, Layer } from "effect"
import { ApiLive } from "../src/api/ApiLive.ts"
import { DatabaseLive } from "../src/db/Database.ts"

/*
 * End-to-end coverage of the auth rate limiting: that the limits are actually
 * wired into the HTTP layer, that they produce a 429 with a `Retry-After`
 * header, and that the per-username lockout survives a correct password.
 * `src/api/RateLimiter.ts`'s own semantics (window expiry, exponential backoff)
 * are covered by `test/rate-limiter.test.ts` against a TestClock.
 */

process.env["DB_FILENAME"] = ":memory:"

// Limits are pinned through a ConfigProvider rather than the environment so
// this file can't leak tight limits into the other test files (bun runs them
// all in one process). Anything not listed here still falls through to env.
const TestConfig = Layer.setConfigProvider(
  ConfigProvider.fromMap(
    new Map([
      ["RATE_LIMIT_REGISTER_MAX", "2"],
      ["RATE_LIMIT_REGISTER_WINDOW_SECONDS", "3600"],
      ["RATE_LIMIT_LOGIN_MAX", "24"],
      ["RATE_LIMIT_LOGIN_WINDOW_SECONDS", "3600"],
      ["RATE_LIMIT_LOCKOUT_THRESHOLD", "3"],
      ["RATE_LIMIT_LOCKOUT_BASE_SECONDS", "60"]
    ])
  ).pipe(ConfigProvider.orElse(() => ConfigProvider.fromEnv()))
)

const AppLive = Layer.merge(ApiLive.pipe(Layer.provide(DatabaseLive)), BunHttpServer.layerContext).pipe(
  Layer.provide(TestConfig)
)

const { handler, dispose } = HttpApiBuilder.toWebHandler(AppLive)

afterAll(() => dispose())

const post = (path: string, body: unknown) =>
  handler(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  )

const login = (username: string, password: string) => post("/auth/login", { username, password })

interface TooManyRequestsBody {
  readonly _tag: string
  readonly retryAfterSeconds: number
}

beforeAll(async () => {
  expect((await post("/auth/register", { username: "alice", password: "supersecret" })).status).toBe(201)
  expect((await post("/auth/register", { username: "bob", password: "supersecret" })).status).toBe(201)
})

describe("POST /auth/register", () => {
  test("rejects bulk registration from one client with 429 and a Retry-After header", async () => {
    const response = await post("/auth/register", { username: "carol", password: "supersecret" })

    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("3600")

    const body = (await response.json()) as TooManyRequestsBody
    expect(body._tag).toBe("TooManyRequests")
    expect(body.retryAfterSeconds).toBe(3600)
  })
})

describe("POST /auth/login", () => {
  test("locks an account after repeated failures instead of serving every guess", async () => {
    const attempts = []
    for (let i = 0; i < 4; i++) {
      attempts.push((await login("alice", "wrongpassword")).status)
    }

    // Three guesses are answered normally; the fourth is refused outright.
    expect(attempts).toEqual([401, 401, 401, 429])
  })

  test("keeps refusing while locked, even with the correct password", async () => {
    const response = await login("alice", "supersecret")

    expect(response.status).toBe(429)
    expect(response.headers.get("retry-after")).toBe("60")
  })

  test("locks an unknown username too, so 429 does not leak account existence", async () => {
    const attempts = []
    for (let i = 0; i < 4; i++) {
      attempts.push((await login("ghostuser", "wrongpassword")).status)
    }

    expect(attempts).toEqual([401, 401, 401, 429])
  })

  test("caps total attempts per client regardless of which account is targeted", async () => {
    // The lockout above is per account; this budget is per IP, so a correct
    // password for an unlocked account still consumes it.
    const statuses = []
    for (let i = 0; i < 20; i++) {
      const status = (await login("bob", "supersecret")).status
      statuses.push(status)
      if (status === 429) break
    }

    expect(statuses).toContain(429)
    expect(statuses.at(-1)).toBe(429)
    expect(statuses.filter((status) => status === 200).length).toBeGreaterThan(0)
  })
})

test("rate limiting is confined to the auth endpoints", async () => {
  // The login budget is exhausted by the test above; unrelated routes are not.
  const response = await handler(new Request("http://localhost/health"))
  expect(response.status).toBe(200)
})
