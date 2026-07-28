import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { HttpApiBuilder } from "@effect/platform"
import { BunHttpServer } from "@effect/platform-bun"
import { ConfigProvider, Layer } from "effect"
import { ApiLive } from "../src/api/ApiLive.ts"
import { DatabaseLive } from "../src/db/Database.ts"

// Isolated in-memory database per test file, built once and reused across
// requests for the lifetime of this file (see HttpApiBuilder.toWebHandler).
process.env["DB_FILENAME"] = ":memory:"

// The auth endpoints are rate limited, and every request in this file comes
// from the same (absent) client address, so the production defaults would
// eventually reject them. Rate limiting itself is covered by
// `test/auth-rate-limit.test.ts`; here it just needs to stay out of the way.
const NoRateLimits = Layer.setConfigProvider(
  ConfigProvider.fromMap(new Map([["RATE_LIMIT_ENABLED", "false"]])).pipe(
    ConfigProvider.orElse(() => ConfigProvider.fromEnv())
  )
)

const AppLive = Layer.merge(ApiLive.pipe(Layer.provide(DatabaseLive)), BunHttpServer.layerContext).pipe(
  Layer.provide(NoRateLimits)
)

const { handler, dispose } = HttpApiBuilder.toWebHandler(AppLive)

afterAll(() => dispose())

const request = (path: string, init?: RequestInit) => handler(new Request(`http://localhost${path}`, init))

interface AuthResponseBody {
  readonly token: string
  readonly user: { readonly id: string; readonly username: string; readonly createdAt: string }
}

interface UserBody {
  readonly id: string
  readonly username: string
  readonly createdAt: string
}

const registerUser = (username: string, password: string) =>
  request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  })

describe("POST /auth/register", () => {
  test("registers a new user and returns a token", async () => {
    const response = await registerUser("johndoe", "supersecret")
    expect(response.status).toBe(201)

    const body = (await response.json()) as AuthResponseBody
    expect(body.user).toMatchObject({ username: "johndoe" })
    expect(typeof body.token).toBe("string")
  })

  test("rejects a duplicate username", async () => {
    const response = await registerUser("johndoe", "supersecret")
    expect(response.status).toBe(409)
  })

  test("rejects an invalid payload", async () => {
    const response = await registerUser("j", "short")
    expect(response.status).toBe(400)
  })

  test("rejects a duplicate username differing only by case", async () => {
    const response = await registerUser("JohnDoe", "supersecret")
    expect(response.status).toBe(409)
  })
})

describe("POST /auth/login", () => {
  test("logs in with correct credentials", async () => {
    const response = await request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "johndoe", password: "supersecret" })
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as AuthResponseBody
    expect(typeof body.token).toBe("string")
  })

  test("rejects an unknown username", async () => {
    const response = await request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "nosuchuser", password: "supersecret" })
    })
    expect(response.status).toBe(401)
  })

  test("rejects a wrong password", async () => {
    const response = await request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "johndoe", password: "wrongpassword" })
    })
    expect(response.status).toBe(401)
  })

  test("logs in with a username differing only by case", async () => {
    const response = await request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "JohnDoe", password: "supersecret" })
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as AuthResponseBody
    expect(body.user.username).toBe("johndoe")
  })
})

describe("GET /users/me", () => {
  let token: string

  beforeAll(async () => {
    const response = await request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "johndoe", password: "supersecret" })
    })
    ;({ token } = (await response.json()) as AuthResponseBody)
  })

  test("returns the current user for a valid token", async () => {
    const response = await request("/users/me", { headers: { Authorization: `Bearer ${token}` } })
    expect(response.status).toBe(200)
    const body = (await response.json()) as UserBody
    expect(body.username).toBe("johndoe")
  })

  test("rejects a missing token", async () => {
    const response = await request("/users/me")
    expect(response.status).toBe(401)
  })

  test("rejects an invalid token", async () => {
    const response = await request("/users/me", { headers: { Authorization: "Bearer garbage" } })
    expect(response.status).toBe(401)
  })
})

// The invariant these guard used to live in a COLLATE NOCASE hand-edit in the
// migration file, which drizzle-kit dropped whenever it regenerated the table.
// It is now the `users.username_lower` column and its UNIQUE index.
describe("case-insensitive usernames", () => {
  test("registration preserves the casing that was typed", async () => {
    const response = await registerUser("NurseAmy", "supersecret")
    expect(response.status).toBe(201)
    const body = (await response.json()) as AuthResponseBody
    expect(body.user.username).toBe("NurseAmy")
  })

  test("a lowercase variant of a mixed-case username is a duplicate", async () => {
    const response = await registerUser("nurseamy", "supersecret")
    expect(response.status).toBe(409)
  })

  test("logging in with different casing returns the stored casing", async () => {
    const response = await request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "NURSEAMY", password: "supersecret" })
    })
    expect(response.status).toBe(200)
    const body = (await response.json()) as AuthResponseBody
    expect(body.user.username).toBe("NurseAmy")

    const me = await request("/users/me", { headers: { Authorization: `Bearer ${body.token}` } })
    expect(((await me.json()) as UserBody).username).toBe("NurseAmy")
  })
})
