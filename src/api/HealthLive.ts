import { HttpApiBuilder } from "@effect/platform"
import { Effect } from "effect"
import { HealthStatus, ServiceUnavailable } from "../domain/Health.ts"
import { Db } from "../db/Database.ts"
import { users } from "../db/schema.ts"
import { Api } from "./Api.ts"

export const HealthLive = HttpApiBuilder.group(Api, "health", (handlers) =>
  handlers
    // Liveness: deliberately touches nothing. It answers "is this process still
    // running and accepting connections", which is the only question a restart
    // can fix.
    .handle("health", () => Effect.succeed(new HealthStatus({ status: "ok" })))
    // Readiness: a real round trip to SQLite, which is what every endpoint that
    // matters needs. Selecting one column of one row proves the connection is
    // open, the file is readable and the schema is present, for about as little
    // work as a query can cost — cheap enough for a 30s probe.
    //
    // The `Effect.catchAll(Effect.die)` used by the other handlers would be
    // exactly wrong here: a DB failure is the condition this endpoint exists to
    // report, so it becomes a declared 503 instead of a defect. The cause is
    // logged because the response body deliberately doesn't carry it.
    .handle("ready", () =>
      Effect.gen(function* () {
        const db = yield* Db

        yield* Effect.try(() => db.select({ id: users.id }).from(users).limit(1).all()).pipe(
          Effect.tapError((error) => Effect.logError("Readiness check failed: database is not usable", error)),
          Effect.mapError(() => new ServiceUnavailable({ check: "database" }))
        )

        return new HealthStatus({ status: "ok" })
      })
    )
)
