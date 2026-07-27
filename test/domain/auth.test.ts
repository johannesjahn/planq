import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { JwtConfigLive, hashPassword, signToken, verifyPassword, verifyToken } from "../../src/domain/Auth.ts"

describe("password hashing", () => {
  test("verifies a matching password against its hash", async () => {
    const hash = await Effect.runPromise(hashPassword("supersecret"))
    const valid = await Effect.runPromise(verifyPassword("supersecret", hash))
    expect(valid).toBe(true)
  })

  test("rejects a non-matching password", async () => {
    const hash = await Effect.runPromise(hashPassword("supersecret"))
    const valid = await Effect.runPromise(verifyPassword("wrongpassword", hash))
    expect(valid).toBe(false)
  })
})

describe("jwt tokens", () => {
  test("round-trips id and username through sign and verify", async () => {
    const program = Effect.gen(function* () {
      const token = yield* signToken({ id: 42, username: "johndoe" })
      return yield* verifyToken(token)
    }).pipe(Effect.provide(JwtConfigLive))

    const session = await Effect.runPromise(program)
    expect(Number(session.id)).toBe(42)
    expect(session.username).toBe("johndoe")
  })

  test("fails to verify a tampered token", async () => {
    const program = Effect.gen(function* () {
      const token = yield* signToken({ id: 1, username: "johndoe" })
      return yield* verifyToken(`${token}tampered`)
    }).pipe(Effect.provide(JwtConfigLive))

    const exit = await Effect.runPromiseExit(program)
    expect(exit._tag).toBe("Failure")
  })
})
