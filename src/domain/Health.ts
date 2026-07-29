import { HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

/** The body both probes return when they pass. */
export class HealthStatus extends Schema.Class<HealthStatus>("HealthStatus")({
  status: Schema.Literal("ok")
}) {}

/**
 * Returned by the readiness probe when a dependency the API needs in order to
 * serve real traffic is unusable — today that only means the database.
 *
 * This is a genuine domain error rather than a defect: reporting the failure
 * *is* what the endpoint is for, so unlike every other handler in this codebase
 * the readiness handler must not `Effect.die` on a DB error. `check` names the
 * dependency that failed so an operator reading the probe's body knows where to
 * look; it deliberately carries no detail from the underlying error, which is
 * logged server-side instead of being handed to an unauthenticated caller.
 */
export class ServiceUnavailable extends Schema.TaggedError<ServiceUnavailable>()(
  "ServiceUnavailable",
  { check: Schema.String },
  HttpApiSchema.annotations({ status: 503 })
) {}
