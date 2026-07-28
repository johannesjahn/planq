import { describe, expect, test } from "bun:test"
import { ConfigProvider, Effect } from "effect"
import { JWT_SECRET_MIN_LENGTH, JwtConfig, JwtConfigLive, validateJwtSecret } from "../../src/domain/Auth.ts"

/*
 * A weak JWT_SECRET is an authentication bypass waiting to happen: HS256's
 * security is bounded by the secret's entropy, and one captured token is enough
 * to brute-force a guessable key offline. These tests pin the startup check
 * that keeps such a value from ever reaching `jose.SignJWT`.
 *
 * The layer is built through a `ConfigProvider` rather than `process.env` —
 * test files share a process, so setting the variable here would leak into
 * whichever file bun runs next.
 */

const buildWith = (secret: string) =>
  Effect.runPromiseExit(
    Effect.map(JwtConfig, ({ secret }) => secret).pipe(
      Effect.provide(JwtConfigLive),
      Effect.withConfigProvider(ConfigProvider.fromMap(new Map([["JWT_SECRET", secret]])))
    )
  )

const strongSecret = "H4rQ2p+Lm9ZxTb7Vw0KcYdEfGjNsUa1i"

describe("validateJwtSecret", () => {
  test("accepts a secret shaped like `openssl rand -base64 32` output", () => {
    expect(validateJwtSecret(strongSecret)).toBeUndefined()
  })

  test("rejects a secret shorter than the HS256 key floor", () => {
    expect(strongSecret.length).toBe(JWT_SECRET_MIN_LENGTH)
    expect(validateJwtSecret(strongSecret.slice(0, JWT_SECRET_MIN_LENGTH - 1))).toContain("at least 32 characters")
    expect(validateJwtSecret("a")).toBeDefined()
    expect(validateJwtSecret("")).toBeDefined()
  })

  test("rejects the placeholder that .env.example used to ship, despite it clearing the length check", () => {
    const placeholder = "change-me-to-a-long-random-string"
    expect(placeholder.length).toBeGreaterThanOrEqual(JWT_SECRET_MIN_LENGTH)
    expect(validateJwtSecret(placeholder)).toContain("publicly known placeholder")
  })

  test("matches placeholders regardless of case and surrounding whitespace", () => {
    expect(validateJwtSecret("  Change-Me-To-A-Long-Random-String \n")).toContain("publicly known placeholder")
    expect(validateJwtSecret("secret")).toContain("publicly known placeholder")
  })

  test("rejects a long but repetitive secret", () => {
    expect(validateJwtSecret("a".repeat(64))).toContain("repetitive")
    expect(validateJwtSecret("abab".repeat(16))).toContain("repetitive")
  })

  test("never echoes the secret back in the failure message", () => {
    for (const weak of ["hunter2", "change-me-to-a-long-random-string", "z".repeat(40)]) {
      expect(validateJwtSecret(weak)).not.toContain(weak)
    }
  })
})

describe("JwtConfigLive", () => {
  test("builds on a strong JWT_SECRET, encoding it as UTF-8 bytes", async () => {
    const exit = await buildWith(strongSecret)
    expect(exit._tag).toBe("Success")
    if (exit._tag === "Success") {
      expect(exit.value).toEqual(new TextEncoder().encode(strongSecret))
    }
  })

  test("fails to build on a weak JWT_SECRET, so the server never starts with one", async () => {
    for (const weak of ["", "a", "change-me-to-a-long-random-string", "a".repeat(64)]) {
      const exit = await buildWith(weak)
      expect(exit._tag).toBe("Failure")
    }
  })
})
