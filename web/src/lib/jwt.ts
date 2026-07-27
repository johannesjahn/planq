/**
 * Reads the `exp` claim out of a JWT.
 *
 * Decode only — the signature is never checked here and the result must not be
 * treated as a security decision. It exists so the UI can show when the current
 * session lapses; the API is what actually enforces expiry.
 */
export function jwtExpiresAt(token: string): Date | null {
  const [, payload] = token.split(".")
  if (payload === undefined) return null

  try {
    const json: unknown = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
    if (typeof json === "object" && json !== null && "exp" in json && typeof json.exp === "number") {
      return new Date(json.exp * 1000)
    }
    return null
  } catch {
    return null
  }
}
