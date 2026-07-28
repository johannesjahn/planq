import { HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

/**
 * Returned when a client has exhausted an auth rate-limit window, or when an
 * account is temporarily locked after repeated failed logins.
 *
 * `retryAfterSeconds` is also emitted as a `Retry-After` response header (see
 * `src/api/RateLimiter.ts`); it is duplicated in the body so the frontend can
 * render a countdown without reading headers through its generated client.
 */
export class TooManyRequests extends Schema.TaggedError<TooManyRequests>()(
  "TooManyRequests",
  { retryAfterSeconds: Schema.Number },
  HttpApiSchema.annotations({ status: 429 })
) {}
