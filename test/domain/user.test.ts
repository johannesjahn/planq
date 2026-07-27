import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { RegisterPayload } from "../../src/domain/User.ts"

const decode = Schema.decodeUnknownSync(RegisterPayload)

describe("RegisterPayload", () => {
  test("accepts a valid username and password", () => {
    const result = decode({ username: "johndoe", password: "supersecret" })
    expect(result.username).toBe("johndoe")
    expect(result.password).toBe("supersecret")
  })

  test("rejects a username with invalid characters", () => {
    expect(() => decode({ username: "bad@name", password: "supersecret" })).toThrow()
  })

  test("rejects a username shorter than 3 characters", () => {
    expect(() => decode({ username: "jd", password: "supersecret" })).toThrow()
  })

  test("rejects a username longer than 32 characters", () => {
    expect(() => decode({ username: "a".repeat(33), password: "supersecret" })).toThrow()
  })

  test("rejects a password shorter than 8 characters", () => {
    expect(() => decode({ username: "johndoe", password: "short" })).toThrow()
  })

  test("rejects a missing password", () => {
    expect(() => decode({ username: "johndoe" })).toThrow()
  })
})
