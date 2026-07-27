import { HttpApiBuilder } from "@effect/platform"
import type { SqlError } from "@effect/sql"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import { Effect } from "effect"
import { hashPassword, signToken, verifyPasswordConstantTime } from "../domain/Auth.ts"
import { UsernameAlreadyInUse, InvalidCredentials, AuthResponse, User, UserId } from "../domain/User.ts"
import { Api } from "./Api.ts"

interface UserRow {
  readonly id: number
  readonly username: string
  readonly createdAt: string
}

interface UserRowWithHash extends UserRow {
  readonly passwordHash: string
}

// SQLite reports a duplicate-key insert as a generic SqlError; the driver
// attaches the underlying sqlite3 error code as `cause.code`.
const isUniqueConstraintViolation = (error: SqlError.SqlError) =>
  typeof error.cause === "object" &&
  error.cause !== null &&
  "code" in error.cause &&
  error.cause.code === "SQLITE_CONSTRAINT_UNIQUE"

export const AuthLive = HttpApiBuilder.group(Api, "auth", (handlers) =>
  handlers
    .handle("register", ({ payload }) =>
      Effect.gen(function* () {
        const sql = yield* SqliteClient.SqliteClient
        const passwordHash = yield* hashPassword(payload.password)

        const [row] = yield* sql<UserRow>`
          INSERT INTO users (username, password_hash)
          VALUES (${payload.username}, ${passwordHash})
          RETURNING id, username, created_at as createdAt
        `

        const token = yield* signToken({ id: row!.id, username: row!.username })
        return new AuthResponse({
          token,
          user: new User({ id: UserId.make(row!.id), username: row!.username, createdAt: row!.createdAt })
        })
      }).pipe(
        // Relying on the UNIQUE constraint (rather than a check-then-insert)
        // avoids a race where two concurrent registrations for the same
        // username both pass a pre-check SELECT.
        Effect.catchTag("SqlError", (error) =>
          isUniqueConstraintViolation(error)
            ? Effect.fail(new UsernameAlreadyInUse({ username: payload.username }))
            : Effect.die(error)
        )
      )
    )
    .handle("login", ({ payload }) =>
      Effect.gen(function* () {
        const sql = yield* SqliteClient.SqliteClient

        const [row] = yield* sql<UserRowWithHash>`
          SELECT id, username, created_at as createdAt, password_hash as passwordHash
          FROM users
          WHERE username = ${payload.username}
        `

        // Always run the (slow) password verification, even on a lookup
        // miss, so response time doesn't reveal whether the username exists.
        const valid = yield* verifyPasswordConstantTime(payload.password, row?.passwordHash)
        if (!row || !valid) {
          return yield* Effect.fail(new InvalidCredentials())
        }

        const token = yield* signToken({ id: row.id, username: row.username })
        return new AuthResponse({
          token,
          user: new User({ id: UserId.make(row.id), username: row.username, createdAt: row.createdAt })
        })
      }).pipe(Effect.catchTag("SqlError", Effect.die))
    )
)
