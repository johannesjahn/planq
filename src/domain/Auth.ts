import { Config, Context, Effect, Layer, Redacted, Schema } from "effect"
import * as jose from "jose"
import { UserId } from "./User.ts"

export interface Session {
  readonly id: UserId
  readonly username: string
}

export class CurrentUser extends Context.Tag("CurrentUser")<CurrentUser, Session>() {}

export class JwtConfig extends Context.Tag("JwtConfig")<JwtConfig, { readonly secret: Uint8Array }>() {}

// A missing JWT_SECRET must fail startup, not silently fall back to a
// well-known value that would let anyone forge tokens. The one exception is
// `bun test` (NODE_ENV=test is set automatically), which has no .env file.
const jwtSecretConfig =
  process.env.NODE_ENV === "test"
    ? Config.redacted("JWT_SECRET").pipe(Config.withDefault(Redacted.make("test-only-jwt-secret")))
    : Config.redacted("JWT_SECRET")

export const JwtConfigLive = Layer.effect(
  JwtConfig,
  jwtSecretConfig.pipe(Effect.map((secret) => ({ secret: new TextEncoder().encode(Redacted.value(secret)) })))
)

// `bun test` sets NODE_ENV=test automatically. Argon2id's cost params are
// deliberately expensive (~60ms/op at Bun's defaults) to resist brute force
// in production; that cost buys nothing in tests, so it's turned down there.
const hashOptions: Bun.Password.Argon2Algorithm =
  process.env.NODE_ENV === "test" ? { algorithm: "argon2id", memoryCost: 19, timeCost: 1 } : { algorithm: "argon2id" }

export const hashPassword = (password: string) => Effect.promise(() => Bun.password.hash(password, hashOptions))

export const verifyPassword = (password: string, hash: string) =>
  Effect.promise(() => Bun.password.verify(password, hash))

// Computed once, on first use, and reused for every login attempt against a
// username that doesn't exist. Without this, a lookup miss returns instantly
// while a real user with a wrong password waits on argon2id verification —
// the timing difference lets an attacker enumerate valid usernames even
// though both cases return the same 401 body.
const dummyHash = Bun.password.hash("dummy-password-for-timing-safety", hashOptions)

export const verifyPasswordConstantTime = (password: string, hash: string | undefined) =>
  Effect.promise(async () => Bun.password.verify(password, hash ?? (await dummyHash)))

export const signToken = (payload: { id: string; username: string }) =>
  Effect.gen(function* () {
    const { secret } = yield* JwtConfig
    const token = yield* Effect.promise(() =>
      new jose.SignJWT({ username: payload.username })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(payload.id)
        .setIssuedAt()
        .setExpirationTime("2h")
        .sign(secret)
    )
    return token
  })

export const verifyToken = (token: string): Effect.Effect<Session, Error, JwtConfig> =>
  Effect.gen(function* () {
    const { secret } = yield* JwtConfig
    const { payload } = yield* Effect.tryPromise({
      // Pin to HS256 explicitly rather than relying on jose's default
      // key-type inference, so a future change to `secret`'s type can't
      // silently widen which algorithms a token is accepted under.
      try: () => jose.jwtVerify(token, secret, { algorithms: ["HS256"] }),
      catch: () => new Error("invalid token")
    })
    // `sub` must be a well-formed UUID, not just any string, so a token
    // signed with a stale/foreign format can't be coerced into a UserId.
    if (!Schema.is(UserId)(payload.sub)) {
      return yield* Effect.fail(new Error("invalid token"))
    }
    const username = typeof payload["username"] === "string" ? payload["username"] : ""
    return { id: UserId.make(payload.sub), username }
  })
