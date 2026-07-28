import type { User } from "@/lib/api"

const STORAGE_KEY = "planq.session"

export type StoredSession = {
  token: string
  user: User
}

/*
 * The API issues a bearer JWT, so the session has to live somewhere the client can
 * read it back on reload. localStorage is the pragmatic choice for a token-based
 * API on a separate origin; if this ever moves behind the same origin as the API,
 * an httpOnly cookie would be the stronger option.
 */
export function readSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null

    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "token" in parsed &&
      typeof parsed.token === "string" &&
      "user" in parsed
    ) {
      return parsed as StoredSession
    }
    return null
  } catch {
    // Malformed or unavailable storage (private mode, quota) is treated as "no session".
    return null
  }
}

export function writeSession(session: StoredSession) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Non-fatal: the session simply won't survive a reload.
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Non-fatal.
  }
}
