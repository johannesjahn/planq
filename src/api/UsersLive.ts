import { HttpApiBuilder } from "@effect/platform"
import { eq } from "drizzle-orm"
import { Effect } from "effect"
import { CurrentUser } from "../domain/Auth.ts"
import { User, Unauthorized, UserId } from "../domain/User.ts"
import { Db } from "../db/Database.ts"
import { users } from "../db/schema.ts"
import { Api } from "./Api.ts"

export const UsersLive = HttpApiBuilder.group(Api, "users", (handlers) =>
  handlers.handle("me", () =>
    Effect.gen(function* () {
      const currentUser = yield* CurrentUser
      const db = yield* Db

      const row = yield* Effect.try(() => db.select().from(users).where(eq(users.id, currentUser.id)).get()).pipe(
        Effect.catchAll(Effect.die)
      )

      if (!row) {
        return yield* Effect.fail(new Unauthorized())
      }

      return new User({ id: UserId.make(row.id), username: row.username, createdAt: row.createdAt })
    })
  )
)
