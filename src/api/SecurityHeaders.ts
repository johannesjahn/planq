import { HttpApiBuilder, HttpApp, HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { Config, Effect } from "effect"

/**
 * Security response headers, applied to every response the API produces.
 *
 * None of these protect the API itself — a JSON endpoint has no DOM to attack.
 * They matter because a browser is on the other end of it: the frontend holds a
 * bearer token in `localStorage` (see `web/src/features/auth/session-storage.ts`),
 * which no `httpOnly` flag can protect, so the headers below are the substitute
 * defence. Each one closes a specific hole:
 *
 *  - `Strict-Transport-Security` — stops a first-visit or post-expiry request
 *    being downgraded to plain HTTP with the bearer token on it.
 *  - `X-Content-Type-Options: nosniff` — stops a JSON error body being sniffed
 *    into something the browser will execute.
 *  - `X-Frame-Options` / CSP `frame-ancestors` — no origin can frame us, so
 *    there is nothing to clickjack. Both are sent because `X-Frame-Options` is
 *    what older browsers and some scanners look for.
 *  - `Referrer-Policy: no-referrer` — a URL of ours never reaches a third party
 *    through a `Referer` header.
 *  - `Content-Security-Policy` — see the two policies below.
 */

/** One year, the shortest max-age the HSTS preload list will accept. */
const DEFAULT_HSTS_MAX_AGE_SECONDS = 31_536_000

/**
 * `Strict-Transport-Security`'s `max-age`, in seconds. `0` drops the header
 * entirely, for the rare deployment that has to keep serving plain HTTP —
 * a max-age already sent cannot be taken back before it expires.
 */
export const hstsMaxAgeSeconds: Config.Config<number> = Config.integer("HSTS_MAX_AGE_SECONDS").pipe(
  Config.withDefault(DEFAULT_HSTS_MAX_AGE_SECONDS)
)

/**
 * Whether `X-Forwarded-Proto` may be believed. Same header-forgery reasoning as
 * `TRUST_PROXY` in `RateLimitMiddleware.ts`, and deliberately the same flag: a
 * client that can forge the scheme can talk the server out of sending HSTS.
 */
const trustProxy: Config.Config<boolean> = Config.boolean("TRUST_PROXY").pipe(Config.withDefault(false))

/**
 * The policy for a JSON response. `default-src 'none'` is the whole of it —
 * this API's responses load nothing, embed nothing and script nothing — plus
 * the three directives `default-src` does not fall back to.
 */
const JSON_CSP = ["default-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'"].join("; ")

/**
 * The policy for an HTML response, which today means exactly one route: the
 * Swagger UI at `/docs`. `HttpApiSwagger` inlines the entire bundle, the CSS and
 * the OpenAPI document into the page, so `'unsafe-inline'` is unavoidable there
 * and `default-src 'none'` would render a blank page.
 *
 * That relaxation is the reason the policy is picked per response rather than
 * set once for the whole API: a JSON endpoint should not inherit the carve-out
 * the docs page needs. The better answer is not to serve the docs at all in
 * production — this keeps them working where they are served, it does not make
 * them safe to expose.
 */
const DOCUMENT_CSP = [
  "default-src 'none'",
  // Swagger UI's bundle, and the `window.onload` call that boots it.
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  // Its icons are `data:` URIs; "Try it out" calls back into this API.
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join("; ")

const isHtml = (response: HttpServerResponse.HttpServerResponse): boolean =>
  response.headers["content-type"]?.trimStart().toLowerCase().startsWith("text/html") === true

/**
 * Whether the browser reached us over TLS. Behind a terminating proxy the
 * connection we see is plain HTTP, so the only evidence is `X-Forwarded-Proto`
 * — and that is only evidence when something in front of us overwrites it.
 * Everything else is treated as plain HTTP, which is the direction that fails
 * safe: a missed HSTS header is recoverable, a wrongly-sent one is not.
 */
const isHttps = (request: HttpServerRequest.HttpServerRequest, trustProxy: boolean): boolean => {
  if (trustProxy) {
    const forwarded = request.headers["x-forwarded-proto"]?.split(",")[0]?.trim().toLowerCase()
    if (forwarded !== undefined && forwarded.length > 0) return forwarded === "https"
  }
  // `originalUrl` is the absolute request URL on the Bun and web platforms. A
  // platform that reports a bare path simply never matches, i.e. no HSTS.
  return request.originalUrl.toLowerCase().startsWith("https:")
}

export interface SecurityHeadersOptions {
  readonly hstsMaxAgeSeconds: number
  readonly trustProxy: boolean
}

const headersFor = (
  request: HttpServerRequest.HttpServerRequest,
  response: HttpServerResponse.HttpServerResponse,
  options: SecurityHeadersOptions
): Record<string, string> => {
  const headers: Record<string, string> = {
    "content-security-policy": isHtml(response) ? DOCUMENT_CSP : JSON_CSP,
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer"
  }

  // Sent only over TLS: a browser ignores HSTS on a plain-HTTP response anyway,
  // and not sending it keeps a local HTTP setup from being pinned to a scheme
  // it cannot serve.
  if (options.hstsMaxAgeSeconds > 0 && isHttps(request, options.trustProxy)) {
    headers["strict-transport-security"] = `max-age=${options.hstsMaxAgeSeconds}; includeSubDomains`
  }

  return headers
}

/**
 * Wrapping `app` and mapping its success channel is not enough: a router 404 and
 * a failing `Authorization` middleware both leave the api app through the *error*
 * channel and only become responses later, in `HttpApp.toHandled`. So the headers
 * are attached through the request fiber's pre-response handler, which
 * `toHandled` applies to the error path as well — the same mechanism
 * `RateLimiter` uses to get `Retry-After` onto its 429.
 */
export const securityHeaders =
  (options: SecurityHeadersOptions): HttpApiBuilder.MiddlewareFn<never> =>
  (app) =>
    HttpApp.appendPreResponseHandler((request, response) =>
      Effect.succeed(HttpServerResponse.setHeaders(response, headersFor(request, response, options)))
    ).pipe(Effect.zipRight(app))

export const SecurityHeadersLive = HttpApiBuilder.middleware(
  Effect.map(Effect.all({ hstsMaxAgeSeconds, trustProxy }), securityHeaders)
)
