import { afterAll, describe, expect, test } from "bun:test"
import { HttpApiBuilder, HttpApiSwagger } from "@effect/platform"
import { BunHttpServer } from "@effect/platform-bun"
import { ConfigProvider, Layer } from "effect"
import { ApiLive } from "../src/api/ApiLive.ts"
import { DatabaseLive } from "../src/db/Database.ts"

/*
 * The security response headers (`src/api/SecurityHeaders.ts`).
 *
 * The property worth pinning is "every response", not "a successful response":
 * the interesting ones are the responses produced by something other than a
 * handler — an auth rejection, a 404 from the router, the 413 the body cap
 * short-circuits with — because those are the ones a middleware ordering
 * mistake silently drops the headers from.
 */

process.env["DB_FILENAME"] = ":memory:"

const MAX_BODY_BYTES = 512

const JSON_CSP = "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

const withConfig = (overrides: Record<string, string>) => {
  const TestConfig = Layer.setConfigProvider(
    ConfigProvider.fromMap(
      new Map(
        Object.entries({
          MAX_REQUEST_BODY_BYTES: String(MAX_BODY_BYTES),
          RATE_LIMIT_ENABLED: "false",
          ...overrides
        })
      )
    ).pipe(ConfigProvider.orElse(() => ConfigProvider.fromEnv()))
  )

  // Mirrors `Server.ts`: the Swagger route is mounted on the same router the api
  // groups use, so it goes through the same api-level middleware. `provideMerge`
  // feeds it the `Api` it needs while keeping `Api` in the output, which is what
  // `toWebHandler` requires.
  const AppLive = Layer.merge(
    HttpApiSwagger.layer({ path: "/docs" }).pipe(Layer.provideMerge(ApiLive.pipe(Layer.provide(DatabaseLive)))),
    BunHttpServer.layerContext
  ).pipe(Layer.provide(TestConfig))

  return HttpApiBuilder.toWebHandler(AppLive)
}

const defaults = withConfig({})
const trustingProxy = withConfig({ TRUST_PROXY: "true" })
const hstsDisabled = withConfig({ HSTS_MAX_AGE_SECONDS: "0" })

afterAll(async () => {
  await Promise.all([defaults.dispose(), trustingProxy.dispose(), hstsDisabled.dispose()])
})

const get = (url: string, headers?: Record<string, string>) => defaults.handler(new Request(url, { headers }))

describe("security response headers", () => {
  test("sets them on a successful response", async () => {
    const response = await get("http://localhost/health")
    expect(response.status).toBe(200)
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("x-frame-options")).toBe("DENY")
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
    expect(response.headers.get("content-security-policy")).toBe(JSON_CSP)
  })

  test("sets them on an error response", async () => {
    const response = await get("http://localhost/users/me")
    expect(response.status).toBe(401)
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("content-security-policy")).toBe(JSON_CSP)
  })

  test("sets them on an unmatched route", async () => {
    const response = await get("http://localhost/nope")
    expect(response.status).toBe(404)
    expect(response.headers.get("content-security-policy")).toBe(JSON_CSP)
  })

  test("sets them on the 413 from the body cap", async () => {
    // The body cap short-circuits without reaching a handler, so this is the
    // assertion that the header pass really is the outermost middleware.
    const response = await defaults.handler(
      new Request("http://localhost/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "toobig", password: "x".repeat(MAX_BODY_BYTES * 4) })
      })
    )
    expect(response.status).toBe(413)
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("content-security-policy")).toBe(JSON_CSP)
  })

  test("relaxes the policy for the Swagger UI document, and only for it", async () => {
    const response = await get("http://localhost/docs")
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toStartWith("text/html")

    const csp = response.headers.get("content-security-policy") ?? ""
    // Swagger UI is inlined into the page, so the carve-out it needs is exactly
    // inline script and inline style — nothing remote, and still unframeable.
    expect(csp).toContain("script-src 'unsafe-inline'")
    expect(csp).toContain("style-src 'unsafe-inline'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toContain("http")
    // The relaxation must not have leaked onto the JSON responses.
    expect((await get("http://localhost/health")).headers.get("content-security-policy")).toBe(JSON_CSP)
  })
})

describe("HSTS", () => {
  test("is omitted over plain HTTP", async () => {
    const response = await get("http://localhost/health")
    expect(response.headers.get("strict-transport-security")).toBeNull()
  })

  test("is sent over HTTPS", async () => {
    const response = await get("https://localhost/health")
    expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000; includeSubDomains")
  })

  test("ignores X-Forwarded-Proto unless a proxy is trusted", async () => {
    // Believing the header by default would let any client talk the server out
    // of HSTS — or into it — by asserting a scheme it never used.
    const response = await get("http://localhost/health", { "X-Forwarded-Proto": "https" })
    expect(response.headers.get("strict-transport-security")).toBeNull()
  })

  test("reads X-Forwarded-Proto when a proxy is trusted", async () => {
    const secure = await trustingProxy.handler(
      new Request("http://localhost/health", { headers: { "X-Forwarded-Proto": "https" } })
    )
    expect(secure.headers.get("strict-transport-security")).toBe("max-age=31536000; includeSubDomains")

    // A trusted proxy reporting plain HTTP is believed in that direction too.
    const plain = await trustingProxy.handler(
      new Request("https://localhost/health", { headers: { "X-Forwarded-Proto": "http" } })
    )
    expect(plain.headers.get("strict-transport-security")).toBeNull()
  })

  test("can be turned off entirely", async () => {
    const response = await hstsDisabled.handler(new Request("https://localhost/health"))
    expect(response.headers.get("strict-transport-security")).toBeNull()
    // The rest of the headers are unaffected.
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
  })
})
