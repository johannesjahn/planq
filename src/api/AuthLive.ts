import { HttpApiBuilder } from "@effect/platform"
import { eq } from "drizzle-orm"
import { Effect } from "effect"
import { hashPassword, signToken, verifyPasswordConstantTime } from "../domain/Auth.ts"
import { UsernameAlreadyInUse, InvalidCredentials, AuthResponse, User, UserId } from "../domain/User.ts"
import { Db } from "../db/Database.ts"
import { users } from "../db/schema.ts"
import { Api } from "./Api.ts"

// SQLite reports a duplicate-key insert by throwing synchronously; bun:sqlite
// attaches the underlying sqlite3 error code as `.code`. Effect.try wraps
// that thrown error in an UnknownException, preserving it as `.cause`.
const isUniqueConstraintViolation = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "cause" in error &&
  typeof error.cause === "object" &&
  error.cause !== null &&
  "code" in error.cause &&
  error.cause.code === "SQLITE_CONSTRAINT_UNIQUE"

export const AuthLive = HttpApiBuilder.group(Api, "auth", (handlers) =>
  handlers
    .handle("register", ({ payload }) =>
      Effect.gen(function* () {
        const db = yield* Db
        const passwordHash = yield* hashPassword(payload.password)

        const row = yield* Effect.try(() =>
          db
            .insert(users)
            .values({ username: payload.username, passwordHash })
            .returning({ id: users.id, username: users.username, createdAt: users.createdAt })
            .get()
        ).pipe(
          // Relying on the UNIQUE constraint (rather than a check-then-insert)
          // avoids a race where two concurrent registrations for the same
          // username both pass a pre-check SELECT.
          Effect.catchAll((error) =>
            isUniqueConstraintViolation(error)
              ? Effect.fail(new UsernameAlreadyInUse({ username: payload.username }))
              : Effect.die(error)
          )
        )

        const token = yield* signToken({ id: row.id, username: row.username })
        return new AuthResponse({
          token,
          user: new User({ id: UserId.make(row.id), username: row.username, createdAt: row.createdAt })
        })
      })
    )
    .handle("login", ({ payload }) =>
      Effect.gen(function* () {
        const db = yield* Db

        const row = yield* Effect.try(() =>
          db.select().from(users).where(eq(users.username, payload.username)).get()
        ).pipe(Effect.catchAll(Effect.die))

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
      })
    )
)
