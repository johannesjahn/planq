import { afterAll, describe, expect, test } from "bun:test"
import { HttpApiBuilder } from "@effect/platform"
import { BunHttpServer } from "@effect/platform-bun"
import { ConfigProvider, Layer } from "effect"
import { ApiLive } from "../src/api/ApiLive.ts"
import { DatabaseLive } from "../src/db/Database.ts"

/*
 * The request body cap (`src/api/BodyLimit.ts`). Two paths matter and they are
 * reached differently: a body with a `Content-Length` is judged by the header
 * alone, while a body without one has to be read and counted. The second path
 * is the one an attacker picks, so it gets the same coverage as the first.
 */

process.env["DB_FILENAME"] = ":memory:"

const MAX_BODY_BYTES = 512

const TestConfig = Layer.setConfigProvider(
  ConfigProvider.fromMap(
    new Map([
      ["MAX_REQUEST_BODY_BYTES", String(MAX_BODY_BYTES)],
      ["RATE_LIMIT_ENABLED", "false"]
    ])
  ).pipe(ConfigProvider.orElse(() => ConfigProvider.fromEnv()))
)

const AppLive = Layer.merge(ApiLive.pipe(Layer.provide(DatabaseLive)), BunHttpServer.layerContext).pipe(
  Layer.provide(TestConfig)
)

const { handler, dispose } = HttpApiBuilder.toWebHandler(AppLive)

afterAll(() => dispose())

/** A `Content-Length` is set automatically for a string body. */
const post = (path: string, body: string) =>
  handler(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    })
  )

/**
 * A streamed body carries no `Content-Length`, which is exactly how a client
 * would try to slip past a header-only check.
 */
const postChunked = (path: string, body: string) => {
  const chunks = new TextEncoder().encode(body)
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Split across chunks so the size is only known once the stream ends.
      for (let offset = 0; offset < chunks.length; offset += 64) {
        controller.enqueue(chunks.slice(offset, offset + 64))
      }
      controller.close()
    }
  })

  return handler(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stream,
      duplex: "half"
    })
  )
}

const credentials = (username: string, password = "supersecret") => JSON.stringify({ username, password })

/** A payload that is valid apart from being far larger than the cap. */
const oversized = (username: string) =>
  JSON.stringify({ username, password: "supersecret", padding: "x".repeat(MAX_BODY_BYTES * 4) })

interface PayloadTooLargeBody {
  readonly _tag: string
  readonly maxBytes: number
}

describe("request body size limit", () => {
  test("rejects an oversized body with a declared length", async () => {
    const response = await post("/auth/register", oversized("bigbody"))
    expect(response.status).toBe(413)

    const body = (await response.json()) as PayloadTooLargeBody
    expect(body._tag).toBe("PayloadTooLarge")
    expect(body.maxBytes).toBe(MAX_BODY_BYTES)
  })

  test("rejects an oversized body sent without a declared length", async () => {
    const request = new Request("http://localhost/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(oversized("streamedbig")))
          controller.close()
        }
      }),
      duplex: "half"
    })
    expect(request.headers.get("content-length")).toBeNull()

    const response = await handler(request)
    expect(response.status).toBe(413)
    expect(((await response.json()) as PayloadTooLargeBody)._tag).toBe("PayloadTooLarge")
  })

  test("rejects the oversized body before the payload schema sees it", async () => {
    // Invalid *and* oversized: a 413 rather than a 400 proves the size check ran
    // first, which is the whole point — decoding an oversized body is the cost
    // being avoided.
    const response = await post("/auth/register", JSON.stringify({ padding: "x".repeat(MAX_BODY_BYTES * 4) }))
    expect(response.status).toBe(413)
  })

  test("accepts a body within the limit", async () => {
    const response = await post("/auth/register", credentials("smallbody"))
    expect(response.status).toBe(201)
  })

  test("accepts a body within the limit sent without a declared length", async () => {
    const response = await postChunked("/auth/register", credentials("chunkedbody"))
    expect(response.status).toBe(201)

    const login = await postChunked("/auth/login", credentials("chunkedbody"))
    expect(login.status).toBe(200)
  })

  test("leaves bodyless requests alone", async () => {
    const response = await handler(new Request("http://localhost/health"))
    expect(response.status).toBe(200)
  })

  test("still rejects a malformed body with a 400", async () => {
    const response = await post("/auth/register", "not json")
    expect(response.status).toBe(400)
  })
})
