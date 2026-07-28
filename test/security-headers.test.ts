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
 *
 * `Strict-Transport-Security` is not among them, on purpose — see the last test.
 */

process.env["DB_FILENAME"] = ":memory:"

const MAX_BODY_BYTES = 512

const JSON_CSP = "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

const TestConfig = Layer.setConfigProvider(
  ConfigProvider.fromMap(
    new Map([
      ["MAX_REQUEST_BODY_BYTES", String(MAX_BODY_BYTES)],
      ["RATE_LIMIT_ENABLED", "false"]
    ])
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

const { handler, dispose } = HttpApiBuilder.toWebHandler(AppLive)

afterAll(() => dispose())

const get = (url: string) => handler(new Request(url))

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
    const response = await handler(
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

  test("never sends HSTS, over either scheme", async () => {
    // `Strict-Transport-Security` is the TLS terminator's to set: this app cannot
    // see the browser's scheme from behind a proxy without being told to trust a
    // forgeable header, and a max-age sent by mistake cannot be withdrawn. If it
    // ever reappears here, it should be because someone chose that deliberately.
    for (const url of ["http://localhost/health", "https://localhost/health"]) {
      expect((await get(url)).headers.get("strict-transport-security")).toBeNull()
    }
  })
})
