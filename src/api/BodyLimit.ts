import {
  type Headers,
  HttpApiBuilder,
  HttpMethod,
  HttpServerError,
  HttpServerRequest,
  HttpServerResponse,
  UrlParams
} from "@effect/platform"
import { Config, Effect, Option, Schema, Stream } from "effect"
import { PAYLOAD_TOO_LARGE_STATUS, PayloadTooLarge } from "../domain/BodyLimit.ts"

/**
 * A hard cap on how much request body the API will read.
 *
 * Without it the platform buffers the whole body and parses it as JSON before
 * any schema constraint (`Schema.maxLength(128)` on `password`, say) gets a
 * look in, so a ~10 MB POST to the unauthenticated `/auth/*` endpoints costs a
 * full read + `JSON.parse` + decode before being answered with a 400. That is
 * an unauthenticated client spending our memory and CPU at their leisure.
 *
 * The cap is enforced two ways, because a client controls whether the length is
 * declared at all:
 *
 *  - **`Content-Length` present**: compared against the limit and rejected with
 *    413 before a single body byte is read. HTTP framing guarantees the body is
 *    exactly that long, so a declared length within the limit needs no further
 *    guarding and the request is passed through untouched.
 *  - **No `Content-Length`** (chunked transfer encoding, or an HTTP/2 stream
 *    body): the body is read here, counting as it goes, and abandoned as soon
 *    as the total passes the limit. The bytes that did fit are handed to the
 *    handler through a request wrapper, so nothing downstream has to know.
 */
const DEFAULT_MAX_BODY_BYTES = 8 * 1024

/**
 * The largest body the API will accept, in bytes.
 *
 * 8 KiB is roughly an order of magnitude more than the biggest payload this API
 * actually defines: a `{ username, password }` object caps out near 1 KB even
 * when every one of its 160 permitted characters is `\u`-escaped.
 */
export const maxRequestBodyBytes: Config.Config<number> = Config.integer("MAX_REQUEST_BODY_BYTES").pipe(
  Config.withDefault(DEFAULT_MAX_BODY_BYTES)
)

const encodePayloadTooLarge = Schema.encodeSync(PayloadTooLarge)

const rejectOversized = (maxBytes: number) =>
  HttpServerResponse.unsafeJson(encodePayloadTooLarge(new PayloadTooLarge({ maxBytes })), {
    status: PAYLOAD_TOO_LARGE_STATUS
  })

/**
 * The declared body length, or `undefined` when there isn't a usable one. A
 * header that is absent, negative or not a number is treated as "unknown" so it
 * takes the streaming path rather than being waved through.
 */
const declaredBodyBytes = (headers: Headers.Headers): number | undefined => {
  const raw = headers["content-length"]
  if (raw === undefined) return undefined
  const value = Number(raw)
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

interface PartialBody {
  readonly chunks: Array<Uint8Array>
  readonly size: number
}

/**
 * Reads the body, stopping as soon as the accumulated size passes `maxBytes`.
 * Stopping happens on a chunk boundary, so at most one chunk beyond the limit
 * is ever held — the point is that a body of unbounded length is abandoned
 * after a bounded read, not that the cap is byte-exact.
 */
const readBounded = (request: HttpServerRequest.HttpServerRequest, maxBytes: number) =>
  Stream.runFoldWhile(
    request.stream,
    { chunks: [], size: 0 } satisfies PartialBody as PartialBody,
    (partial) => partial.size <= maxBytes,
    (partial, chunk) => {
      partial.chunks.push(chunk)
      return { chunks: partial.chunks, size: partial.size + chunk.length }
    }
  )

const concatChunks = ({ chunks, size }: PartialBody): Uint8Array => {
  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.length
  }
  return body
}

/**
 * A view of `request` whose body accessors serve `body` instead of re-reading
 * the (already consumed, possibly abandoned) socket stream.
 *
 * Built with `Object.create` so everything unrelated to the body — method, url,
 * headers, cookies, remote address, the two brand symbols — keeps delegating to
 * the real request rather than being re-implemented and drifting from it.
 */
const withBufferedBody = (
  request: HttpServerRequest.HttpServerRequest,
  body: Uint8Array
): HttpServerRequest.HttpServerRequest => {
  const decodeError = (cause: unknown) => new HttpServerError.RequestError({ request, reason: "Decode", cause })
  const text = Effect.sync(() => new TextDecoder().decode(body))

  return Object.create(request, {
    stream: { get: () => Stream.succeed(body) },
    text: { get: () => text },
    json: {
      get: () =>
        Effect.flatMap(text, (body) => Effect.try({ try: () => JSON.parse(body) as unknown, catch: decodeError }))
    },
    urlParamsBody: {
      get: () =>
        Effect.flatMap(text, (body) =>
          Effect.try({ try: () => UrlParams.fromInput(new URLSearchParams(body)), catch: decodeError })
        )
    },
    arrayBuffer: { get: () => Effect.succeed(body.buffer as ArrayBuffer) },
    // Prefix routing rebuilds the request; keep the buffered body attached to it.
    modify: {
      value: (options: Parameters<HttpServerRequest.HttpServerRequest["modify"]>[0]) =>
        withBufferedBody(request.modify(options), body)
    }
  }) as HttpServerRequest.HttpServerRequest
}

export const bodyLimit =
  (maxBytes: number): HttpApiBuilder.MiddlewareFn<never> =>
  (app) => {
    // Also caps multipart parsing, which reads `MaxBodySize` itself. Nothing in
    // this API accepts multipart today; the limit should hold if something does.
    const limited = HttpServerRequest.withMaxBodySize(app, Option.some(maxBytes))

    return Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) => {
      if (!HttpMethod.hasBody(request.method)) return limited

      const declared = declaredBodyBytes(request.headers)
      if (declared !== undefined) {
        return declared > maxBytes ? Effect.succeed(rejectOversized(maxBytes)) : limited
      }

      return readBounded(request, maxBytes).pipe(
        Effect.flatMap((partial) =>
          partial.size > maxBytes
            ? Effect.succeed(rejectOversized(maxBytes))
            : Effect.provideService(
                limited,
                HttpServerRequest.HttpServerRequest,
                withBufferedBody(request, concatChunks(partial))
              )
        ),
        // A bodyless request (the platform fails the stream rather than yielding
        // nothing) is not this middleware's problem — let the handler answer it.
        Effect.catchTag("RequestError", () => limited)
      )
    })
  }

export const BodyLimitLive = HttpApiBuilder.middleware(Effect.map(maxRequestBodyBytes, bodyLimit))
