import { Config, ConfigError, Context, Effect, Either, Layer, Redacted, Schema } from "effect"
import * as jose from "jose"
import { UserId } from "./User.ts"

export interface Session {
  readonly id: UserId
  readonly username: string
}

export class CurrentUser extends Context.Tag("CurrentUser")<CurrentUser, Session>() {}

export class JwtConfig extends Context.Tag("JwtConfig")<JwtConfig, { readonly secret: Uint8Array }>() {}

// RFC 8725 §3.5: an HMAC key should be at least as long as the hash output,
// which is 256 bits / 32 bytes for HS256.
export const JWT_SECRET_MIN_LENGTH = 32

// A 32-character string built from one or two repeated characters is long but
// not secret. This is a floor, not an entropy estimate: a random base64 secret
// of the minimum length carries ~25 distinct characters, and even hex carries
// ~14, so nothing generated the documented way comes close to tripping it.
const JWT_SECRET_MIN_DISTINCT_CHARS = 8

// Values that are published somewhere — this repo's own .env.example and
// READMEs — or that people reach for when a field says "put a secret here".
// Compared case-insensitively against the trimmed secret.
const publiclyKnownSecrets = new Set([
  "change-me-to-a-long-random-string",
  "change-me",
  "changeme",
  "change_me",
  "dev-secret",
  "development",
  "password",
  "secret",
  "supersecret",
  "your-jwt-secret",
  "your-secret-here",
  "jwt-secret",
  "jwtsecret"
])

/**
 * Returns a human-readable reason `secret` is unfit to sign tokens with, or
 * `undefined` if it is acceptable.
 *
 * HS256's security is bounded entirely by this string's entropy: an attacker
 * holding one captured token has the header, payload and signature, and can
 * brute-force candidate keys offline with no further contact with the server.
 * Recovering it means forging a token for any user, so a weak value has to be
 * rejected at startup rather than quietly accepted.
 *
 * The messages never echo the value, since they surface in startup logs.
 */
export const validateJwtSecret = (secret: string): string | undefined => {
  const generateHint = "generate one with `openssl rand -base64 32`"
  if (publiclyKnownSecrets.has(secret.trim().toLowerCase())) {
    return `JWT_SECRET is set to a publicly known placeholder — ${generateHint}`
  }
  if (secret.length < JWT_SECRET_MIN_LENGTH) {
    return `JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters (got ${secret.length}) — ${generateHint}`
  }
  if (new Set(secret).size < JWT_SECRET_MIN_DISTINCT_CHARS) {
    return `JWT_SECRET is long but repetitive (fewer than ${JWT_SECRET_MIN_DISTINCT_CHARS} distinct characters) — ${generateHint}`
  }
  return undefined
}

// Long, non-placeholder and never reachable outside `bun test`, so it satisfies
// the same validation every other environment goes through — which is the point
// of running the check on this branch too: the layer under test is the real one.
const testOnlySecret = "test-only-jwt-secret-never-used-outside-bun-test"

// A missing JWT_SECRET must fail startup, not silently fall back to a
// well-known value that would let anyone forge tokens. The one exception is
// `bun test` (NODE_ENV=test is set automatically), which has no .env file.
// A weak secret fails startup the same way a missing one does — the whole
// value of failing fast is lost if the check only covers absence.
const jwtSecretConfig = (
  process.env.NODE_ENV === "test"
    ? Config.redacted("JWT_SECRET").pipe(Config.withDefault(Redacted.make(testOnlySecret)))
    : Config.redacted("JWT_SECRET")
).pipe(
  Config.mapOrFail((secret) => {
    const problem = validateJwtSecret(Redacted.value(secret))
    return problem === undefined ? Either.right(secret) : Either.left(ConfigError.InvalidData(["JWT_SECRET"], problem))
  })
)

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
