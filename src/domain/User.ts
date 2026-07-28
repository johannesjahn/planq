import { HttpApiSchema } from "@effect/platform"
import { Schema } from "effect"

export const UserId = Schema.UUID.pipe(Schema.brand("UserId"))
export type UserId = typeof UserId.Type

export class User extends Schema.Class<User>("User")({
  id: UserId,
  username: Schema.String,
  createdAt: Schema.String
}) {}

const Username = Schema.String.pipe(
  Schema.trimmed(),
  Schema.minLength(3, { message: () => "must be at least 3 characters" }),
  Schema.maxLength(32, { message: () => "must be at most 32 characters" }),
  Schema.pattern(/^[a-zA-Z0-9_]+$/, {
    message: () => "must contain only letters, numbers, and underscores"
  }),
  Schema.annotations({ description: "Unique username" })
)

/**
 * The canonical form of a username, used for every lookup and for the
 * `users.username_lower` UNIQUE index. Usernames are case-insensitive, so
 * "JohnDoe" and "johndoe" must never become two accounts. `username` itself
 * keeps whatever casing was typed at registration and is only ever displayed.
 *
 * `toLowerCase()` is safe to pair with SQLite's ASCII-only `lower()` here
 * because `Username` restricts the character set to `[a-zA-Z0-9_]`.
 */
export const normalizeUsername = (username: string) => username.trim().toLowerCase()

const Password = Schema.String.pipe(
  Schema.minLength(8, { message: () => "must be at least 8 characters" }),
  Schema.maxLength(128),
  Schema.annotations({ description: "User password, minimum 8 characters" })
)

export class RegisterPayload extends Schema.Class<RegisterPayload>("RegisterPayload")({
  username: Username,
  password: Password
}) {}

export class LoginPayload extends Schema.Class<LoginPayload>("LoginPayload")({
  username: Username,
  password: Password
}) {}

export class AuthResponse extends Schema.Class<AuthResponse>("AuthResponse")({
  token: Schema.String,
  user: User
}) {}

export class UsernameAlreadyInUse extends Schema.TaggedError<UsernameAlreadyInUse>()(
  "UsernameAlreadyInUse",
  { username: Schema.String },
  HttpApiSchema.annotations({ status: 409 })
) {}

export class InvalidCredentials extends Schema.TaggedError<InvalidCredentials>()(
  "InvalidCredentials",
  {},
  HttpApiSchema.annotations({ status: 401 })
) {}

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
  HttpApiSchema.annotations({ status: 401 })
) {}
