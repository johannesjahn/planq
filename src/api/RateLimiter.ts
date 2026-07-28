import { HttpApp, HttpServerResponse } from "@effect/platform"
import { Clock, Config, Context, Effect, Layer } from "effect"
import { TooManyRequests } from "../domain/RateLimit.ts"

/**
 * In-process rate limiting for the auth endpoints.
 *
 * Two independent controls, because they defend against different attacks:
 *
 *  - a **per-IP fixed window** on each of `/auth/login` and `/auth/register`,
 *    which caps how much work one client can force the server to do (every
 *    login costs an argon2id verification, including for unknown usernames)
 *    and stops bulk account creation;
 *  - a **per-username lockout** with exponential backoff, which catches a
 *    distributed attack on a single account where no individual IP ever trips
 *    its own window.
 *
 * State lives in this process's memory. That is correct for a single replica
 * and *not* correct behind a load balancer with more than one: each replica
 * would keep its own counters, multiplying the effective limit by the replica
 * count. Moving to more than one instance means moving this state to a shared
 * store (Redis or the database) behind the same `RateLimiter` interface.
 */

export type RateLimitedRoute = "login" | "register"

export interface RateLimiterService {
  /**
   * Counts one request from `ip` against `route`'s window, failing once the
   * window is exhausted. Called before the request payload is decoded, so
   * malformed floods are rejected as cheaply as well-formed ones.
   */
  readonly consume: (route: RateLimitedRoute, ip: string) => Effect.Effect<void, TooManyRequests>
  /**
   * Fails while `username` is locked out. Called *before* the password is
   * verified so a locked account costs no argon2id work.
   */
  readonly checkUsername: (username: string) => Effect.Effect<void, TooManyRequests>
  readonly recordLoginFailure: (username: string) => Effect.Effect<void>
  readonly recordLoginSuccess: (username: string) => Effect.Effect<void>
}

export class RateLimiter extends Context.Tag("RateLimiter")<RateLimiter, RateLimiterService>() {}

interface WindowConfig {
  readonly limit: number
  readonly windowMillis: number
}

interface RateLimitConfig {
  readonly enabled: boolean
  readonly login: WindowConfig
  readonly register: WindowConfig
  readonly lockout: {
    /** Consecutive failures tolerated before the first lock kicks in. */
    readonly threshold: number
    readonly baseMillis: number
    readonly maxMillis: number
    /** How long a failure streak is remembered once the account goes quiet. */
    readonly streakMillis: number
  }
}

const seconds = (name: string, fallback: number) =>
  Config.integer(name).pipe(
    Config.map((value) => value * 1000),
    Config.withDefault(fallback * 1000)
  )

export const rateLimitConfig: Config.Config<RateLimitConfig> = Config.all({
  enabled: Config.boolean("RATE_LIMIT_ENABLED").pipe(Config.withDefault(true)),
  login: Config.all({
    limit: Config.integer("RATE_LIMIT_LOGIN_MAX").pipe(Config.withDefault(10)),
    windowMillis: seconds("RATE_LIMIT_LOGIN_WINDOW_SECONDS", 60)
  }),
  register: Config.all({
    limit: Config.integer("RATE_LIMIT_REGISTER_MAX").pipe(Config.withDefault(5)),
    windowMillis: seconds("RATE_LIMIT_REGISTER_WINDOW_SECONDS", 3600)
  }),
  lockout: Config.all({
    threshold: Config.integer("RATE_LIMIT_LOCKOUT_THRESHOLD").pipe(Config.withDefault(5)),
    baseMillis: seconds("RATE_LIMIT_LOCKOUT_BASE_SECONDS", 30),
    maxMillis: seconds("RATE_LIMIT_LOCKOUT_MAX_SECONDS", 900),
    streakMillis: seconds("RATE_LIMIT_FAILURE_WINDOW_SECONDS", 3600)
  })
})

interface Counter {
  count: number
  resetAt: number
}

interface FailureStreak {
  failures: number
  lockedUntil: number
  expiresAt: number
}

/** How often expired entries are swept out of the two maps. */
const SWEEP_INTERVAL_MILLIS = 60_000

/**
 * Beyond this many tracked keys an attacker is spending our memory rather than
 * their own, so sweep immediately instead of waiting for the interval.
 */
const SWEEP_THRESHOLD_ENTRIES = 50_000

/**
 * Fails with `TooManyRequests` *and* attaches the matching `Retry-After`
 * header. The header can't be declared on the error schema, so it is added
 * through the request fiber's pre-response handler — the same mechanism
 * `HttpApiBuilder.securitySetCookie` uses to set cookies from a handler.
 */
const rejectFor = (retryAfterMillis: number) => {
  const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMillis / 1000))
  return HttpApp.appendPreResponseHandler((_request, response) =>
    Effect.succeed(HttpServerResponse.setHeader(response, "retry-after", String(retryAfterSeconds)))
  ).pipe(Effect.zipRight(Effect.fail(new TooManyRequests({ retryAfterSeconds }))))
}

const noopLimiter: RateLimiterService = {
  consume: () => Effect.void,
  checkUsername: () => Effect.void,
  recordLoginFailure: () => Effect.void,
  recordLoginSuccess: () => Effect.void
}

const make = (config: RateLimitConfig): RateLimiterService => {
  if (!config.enabled) return noopLimiter

  const counters = new Map<string, Counter>()
  const streaks = new Map<string, FailureStreak>()
  let lastSweep = 0

  const sweep = (now: number) => {
    for (const [key, counter] of counters) {
      if (counter.resetAt <= now) counters.delete(key)
    }
    for (const [key, streak] of streaks) {
      if (streak.expiresAt <= now && streak.lockedUntil <= now) streaks.delete(key)
    }
    lastSweep = now
  }

  const maybeSweep = (now: number) => {
    if (now - lastSweep >= SWEEP_INTERVAL_MILLIS || counters.size + streaks.size > SWEEP_THRESHOLD_ENTRIES) {
      sweep(now)
    }
  }

  // Usernames are matched case-insensitively by the database (the column is
  // COLLATE NOCASE), so the lockout key has to be too — otherwise "Alice" and
  // "alice" would get a fresh allowance each.
  const streakKey = (username: string) => username.trim().toLowerCase()

  return {
    consume: (route, ip) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis
        maybeSweep(now)

        const { limit, windowMillis } = config[route]
        const key = `${route}:${ip}`
        const counter = counters.get(key)

        if (counter === undefined || counter.resetAt <= now) {
          counters.set(key, { count: 1, resetAt: now + windowMillis })
          return
        }
        if (counter.count >= limit) {
          return yield* rejectFor(counter.resetAt - now)
        }
        counter.count += 1
      }),

    checkUsername: (username) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis
        const streak = streaks.get(streakKey(username))
        if (streak !== undefined && streak.lockedUntil > now) {
          return yield* rejectFor(streak.lockedUntil - now)
        }
      }),

    recordLoginFailure: (username) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis
        maybeSweep(now)

        const key = streakKey(username)
        const previous = streaks.get(key)
        // A streak that has gone stale starts over, so an account with one bad
        // login a month doesn't creep towards a lockout.
        const failures = previous !== undefined && previous.expiresAt > now ? previous.failures + 1 : 1

        const over = failures - config.lockout.threshold
        const lockedUntil =
          over >= 0
            ? now + Math.min(config.lockout.baseMillis * 2 ** over, config.lockout.maxMillis)
            : (previous?.lockedUntil ?? 0)

        streaks.set(key, { failures, lockedUntil, expiresAt: now + config.lockout.streakMillis })
      }),

    recordLoginSuccess: (username) => Effect.sync(() => streaks.delete(streakKey(username)))
  }
}

export const RateLimiterLive = Layer.effect(RateLimiter, Effect.map(rateLimitConfig, make))
