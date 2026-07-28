import { HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

/** The HTTP status the API answers an oversized request body with. */
export const PAYLOAD_TOO_LARGE_STATUS = 413

/**
 * Returned when a request body exceeds the configured maximum size.
 *
 * `maxBytes` is echoed back so a client can tell "your payload is too big" from
 * "the server is being stingy today" without reading the docs. The limit is not
 * a secret — it is in the OpenAPI document either way.
 */
export class PayloadTooLarge extends Schema.TaggedError<PayloadTooLarge>()(
  "PayloadTooLarge",
  { maxBytes: Schema.Number },
  HttpApiSchema.annotations({ status: PAYLOAD_TOO_LARGE_STATUS })
) {}
