import { describe, expect, test } from "bun:test"
import { ConfigProvider, Duration, Effect, TestClock, TestContext } from "effect"
import type { TooManyRequests } from "../src/domain/RateLimit.ts"
import { RateLimiter, RateLimiterLive, type RateLimiterService } from "../src/api/RateLimiter.ts"

/*
 * Unit tests for the limiter itself. A `ConfigProvider` supplies the limits so
 * nothing here depends on the ambient environment, and `TestClock` lets windows
 * and lockouts expire without the suite actually waiting for them.
 */

const defaults: Record<string, string> = {
  RATE_LIMIT_LOGIN_MAX: "3",
  RATE_LIMIT_LOGIN_WINDOW_SECONDS: "60",
  RATE_LIMIT_REGISTER_MAX: "2",
  RATE_LIMIT_REGISTER_WINDOW_SECONDS: "3600",
  RATE_LIMIT_LOCKOUT_THRESHOLD: "3",
  RATE_LIMIT_LOCKOUT_BASE_SECONDS: "30",
  RATE_LIMIT_LOCKOUT_MAX_SECONDS: "120",
  RATE_LIMIT_FAILURE_WINDOW_SECONDS: "3600"
}

const run = <A, E>(
  body: (limiter: RateLimiterService) => Effect.Effect<A, E>,
  overrides: Record<string, string> = {}
) =>
  Effect.runPromise(
    Effect.flatMap(RateLimiter, body).pipe(
      Effect.provide(RateLimiterLive),
      Effect.withConfigProvider(ConfigProvider.fromMap(new Map(Object.entries({ ...defaults, ...overrides })))),
      Effect.provide(TestContext.TestContext)
    )
  )

/** The `retryAfterSeconds` a check was rejected with, or `null` when it was allowed through. */
const retryAfter = <A>(effect: Effect.Effect<A, TooManyRequests>) =>
  Effect.match(effect, {
    onFailure: (error) => error.retryAfterSeconds,
    onSuccess: (): number | null => null
  })

describe("per-IP windows", () => {
  test("allows up to the limit and rejects the next request", async () => {
    const results = await run((limiter) =>
      Effect.forEach([1, 2, 3, 4], () => retryAfter(limiter.consume("login", "1.2.3.4")))
    )

    expect(results).toEqual([null, null, null, 60])
  })

  test("keeps a separate budget per IP and per route", async () => {
    const results = await run((limiter) =>
      Effect.gen(function* () {
        yield* Effect.replicateEffect(limiter.consume("login", "1.2.3.4"), 3)
        return {
          otherIp: yield* retryAfter(limiter.consume("login", "5.6.7.8")),
          otherRoute: yield* retryAfter(limiter.consume("register", "1.2.3.4"))
        }
      })
    )

    expect(results).toEqual({ otherIp: null, otherRoute: null })
  })

  test("starts a fresh window once the old one elapses", async () => {
    const result = await run((limiter) =>
      Effect.gen(function* () {
        yield* Effect.replicateEffect(limiter.consume("login", "1.2.3.4"), 3)
        yield* TestClock.adjust(Duration.seconds(61))
        return yield* retryAfter(limiter.consume("login", "1.2.3.4"))
      })
    )

    expect(result).toBeNull()
  })
})

describe("per-username lockout", () => {
  const failLogins = (limiter: RateLimiterService, username: string, times: number) =>
    Effect.replicateEffect(limiter.recordLoginFailure(username), times)

  test("locks the account once the failure threshold is reached", async () => {
    const results = await run((limiter) =>
      Effect.gen(function* () {
        yield* failLogins(limiter, "alice", 2)
        const beforeThreshold = yield* retryAfter(limiter.checkUsername("alice"))
        yield* failLogins(limiter, "alice", 1)
        return { beforeThreshold, atThreshold: yield* retryAfter(limiter.checkUsername("alice")) }
      })
    )

    expect(results).toEqual({ beforeThreshold: null, atThreshold: 30 })
  })

  test("backs off exponentially, capped at the configured maximum", async () => {
    const results = await run((limiter) =>
      Effect.gen(function* () {
        yield* failLogins(limiter, "alice", 3)
        const locks = [yield* retryAfter(limiter.checkUsername("alice"))]
        for (let i = 0; i < 3; i++) {
          yield* failLogins(limiter, "alice", 1)
          locks.push(yield* retryAfter(limiter.checkUsername("alice")))
        }
        return locks
      })
    )

    // 30s, then doubling, then held at the 120s cap.
    expect(results).toEqual([30, 60, 120, 120])
  })

  test("lifts the lock once it expires", async () => {
    const result = await run((limiter) =>
      Effect.gen(function* () {
        yield* failLogins(limiter, "alice", 3)
        yield* TestClock.adjust(Duration.seconds(31))
        return yield* retryAfter(limiter.checkUsername("alice"))
      })
    )

    expect(result).toBeNull()
  })

  test("a successful login clears the streak", async () => {
    const result = await run((limiter) =>
      Effect.gen(function* () {
        yield* failLogins(limiter, "alice", 2)
        yield* limiter.recordLoginSuccess("alice")
        yield* failLogins(limiter, "alice", 2)
        return yield* retryAfter(limiter.checkUsername("alice"))
      })
    )

    expect(result).toBeNull()
  })

  test("matches usernames case-insensitively, like the database does", async () => {
    const result = await run((limiter) =>
      Effect.gen(function* () {
        yield* failLogins(limiter, "Alice", 2)
        yield* failLogins(limiter, "ALICE", 1)
        return yield* retryAfter(limiter.checkUsername("alice"))
      })
    )

    expect(result).toBe(30)
  })

  test("forgets a stale failure streak", async () => {
    const result = await run((limiter) =>
      Effect.gen(function* () {
        yield* failLogins(limiter, "alice", 2)
        yield* TestClock.adjust(Duration.hours(2))
        yield* failLogins(limiter, "alice", 2)
        return yield* retryAfter(limiter.checkUsername("alice"))
      })
    )

    expect(result).toBeNull()
  })
})

test("RATE_LIMIT_ENABLED=false turns every check into a no-op", async () => {
  const result = await run(
    (limiter) =>
      Effect.gen(function* () {
        yield* Effect.replicateEffect(limiter.consume("login", "1.2.3.4"), 20)
        yield* Effect.replicateEffect(limiter.recordLoginFailure("alice"), 20)
        return yield* retryAfter(limiter.checkUsername("alice"))
      }),
    { RATE_LIMIT_ENABLED: "false" }
  )

  expect(result).toBeNull()
})
