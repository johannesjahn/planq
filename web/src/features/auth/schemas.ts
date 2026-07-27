import { z } from "zod"

/*
 * Mirrors the constraints on `RegisterPayload` / `LoginPayload` in
 * `src/domain/User.ts` on the backend. The OpenAPI document types the fields as
 * plain strings (JSON Schema keeps `minLength`/`pattern` as annotations rather
 * than something `openapi-typescript` can encode), so the rules are restated here
 * to validate before a round trip. The server remains the authority — a mismatch
 * comes back as a 400 and is surfaced through `ApiError`.
 */

const username = z
  .string()
  .trim()
  .min(3, "At least 3 characters.")
  .max(32, "At most 32 characters.")
  .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers and underscores only.")

const password = z.string().min(8, "At least 8 characters.").max(128, "At most 128 characters.")

export const loginSchema = z.object({
  username,
  password: z.string().min(1, "Enter your password.")
})

export const registerSchema = z
  .object({
    username,
    password,
    confirmPassword: z.string()
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords don’t match.",
    path: ["confirmPassword"]
  })

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>

/** Rough 0–4 strength score used by the sign-up form's meter. */
export function passwordStrength(value: string): number {
  if (value.length === 0) return 0

  let score = 0
  if (value.length >= 8) score += 1
  if (value.length >= 12) score += 1
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score += 1

  return Math.min(score, 4)
}
