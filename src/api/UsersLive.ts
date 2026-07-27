import { HttpApiBuilder } from "@effect/platform"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import { Effect } from "effect"
import { CurrentUser } from "../domain/Auth.ts"
import { User, Unauthorized, UserId } from "../domain/User.ts"
import { Api } from "./Api.ts"

export const UsersLive = HttpApiBuilder.group(Api, "users", (handlers) =>
  handlers.handle("me", () =>
    Effect.gen(function* () {
      const currentUser = yield* CurrentUser
      const sql = yield* SqliteClient.SqliteClient

      const [row] = yield* sql<{ id: number; username: string; createdAt: string }>`
        SELECT id, username, created_at as createdAt FROM users WHERE id = ${currentUser.id}
      `
      if (!row) {
        return yield* Effect.fail(new Unauthorized())
      }

      return new User({ id: UserId.make(row.id), username: row.username, createdAt: row.createdAt })
    }).pipe(Effect.catchTag("SqlError", Effect.die))
  )
)
