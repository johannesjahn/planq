import { HttpApiBuilder, HttpApp, HttpServerResponse } from "@effect/platform"
import { Effect } from "effect"

/**
 * Security response headers, applied to every response the API produces.
 *
 * None of these protect the API itself — a JSON endpoint has no DOM to attack.
 * They matter because a browser is on the other end of it: the frontend holds a
 * bearer token in `localStorage` (see `web/src/features/auth/session-storage.ts`),
 * which no `httpOnly` flag can protect, so the headers below are the substitute
 * defence. Each one closes a specific hole:
 *
 *  - `X-Content-Type-Options: nosniff` — stops a JSON error body being sniffed
 *    into something the browser will execute.
 *  - `X-Frame-Options` / CSP `frame-ancestors` — no origin can frame us, so
 *    there is nothing to clickjack. Both are sent because `X-Frame-Options` is
 *    what older browsers and some scanners look for.
 *  - `Referrer-Policy: no-referrer` — a URL of ours never reaches a third party
 *    through a `Referer` header.
 *  - `Content-Security-Policy` — see the two policies below.
 *
 * **`Strict-Transport-Security` is deliberately not here.** It is a property of
 * the origin, not of this app, and this app is the wrong place to decide it
 * from. Behind a TLS-terminating proxy the connection we see is plain HTTP, so
 * the only evidence of the browser's scheme is `X-Forwarded-Proto` — a header we
 * would have to be told to trust, and getting that wrong means either never
 * sending the header or pinning clients to a scheme the origin cannot serve for
 * the length of the `max-age`, which cannot be withdrawn early. The TLS
 * terminator knows the answer without being told. Set it there; `README.md`
 * says so, and repeats the header set to hide or drop if it sets these too.
 */

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

const headersFor = (response: HttpServerResponse.HttpServerResponse): Record<string, string> => ({
  "content-security-policy": isHtml(response) ? DOCUMENT_CSP : JSON_CSP,
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer"
})

/**
 * Wrapping `app` and mapping its success channel is not enough: a router 404 and
 * a failing `Authorization` middleware both leave the api app through the *error*
 * channel and only become responses later, in `HttpApp.toHandled`. So the headers
 * are attached through the request fiber's pre-response handler, which
 * `toHandled` applies to the error path as well — the same mechanism
 * `RateLimiter` uses to get `Retry-After` onto its 429.
 */
export const securityHeaders: HttpApiBuilder.MiddlewareFn<never> = (app) =>
  HttpApp.appendPreResponseHandler((_request, response) =>
    Effect.succeed(HttpServerResponse.setHeaders(response, headersFor(response)))
  ).pipe(Effect.zipRight(app))

export const SecurityHeadersLive = HttpApiBuilder.middleware(securityHeaders)
