import createClient, { type Middleware } from "openapi-fetch"
import type { components, paths } from "./api.gen"

/*
 * Typed client for the planq API.
 *
 * `paths` / `components` come from `src/lib/api.gen.ts`, which is generated from
 * `web/api.json` — itself generated from the backend's `HttpApi` definition
 * (`bun run openapi:generate` at the repo root, then `bun run api:types` here).
 * Nothing in this file hand-writes a request or response shape: if an endpoint
 * changes, the regenerated types break the call site.
 */

export type User = components["schemas"]["User"]
export type AuthResponse = components["schemas"]["AuthResponse"]
export type RegisterPayload = components["schemas"]["RegisterPayload"]
export type LoginPayload = components["schemas"]["LoginPayload"]

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api"

// Held in a module-level slot rather than threaded through every call so that the
// request middleware can attach it without each caller knowing about auth.
let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
}

const bearerMiddleware: Middleware = {
  onRequest({ request }) {
    if (authToken !== null) {
      request.headers.set("Authorization", `Bearer ${authToken}`)
    }
    return request
  }
}

export const client = createClient<paths>({ baseUrl })
client.use(bearerMiddleware)

/** Any tagged error the API can return, discriminated by `_tag`. */
type ApiErrorBody =
  | components["schemas"]["UsernameAlreadyInUse"]
  | components["schemas"]["InvalidCredentials"]
  | components["schemas"]["Unauthorized"]
  | components["schemas"]["TooManyRequests"]
  | components["schemas"]["PayloadTooLarge"]
  | components["schemas"]["HttpApiDecodeError"]

export class ApiError extends Error {
  readonly status: number
  readonly body: ApiErrorBody | undefined

  constructor(message: string, status: number, body?: ApiErrorBody) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }

  /** True when the session is gone or was never valid — the caller should log out. */
  get isUnauthorized() {
    return this.status === 401
  }

  /** True when the API is throttling this client — retrying immediately will not help. */
  get isRateLimited() {
    return this.status === 429
  }
}

/** Renders the wait a 429 asks for as something a person would say out loud. */
function formatWait(seconds: number): string {
  if (seconds < 90) return `${Math.max(1, Math.round(seconds))} seconds`
  const minutes = Math.round(seconds / 60)
  return minutes < 60 ? `${minutes} minutes` : "an hour"
}

function hasTag(body: unknown): body is ApiErrorBody {
  return typeof body === "object" && body !== null && "_tag" in body
}

function messageFor(body: unknown, status: number): string {
  if (!hasTag(body)) {
    // A network failure surfaces as no body at all; openapi-fetch reports it as
    // a rejected promise, so anything landing here is a real (if unlabelled) HTTP
    // response — most likely a 5xx from the server.
    return status === 0 ? "Could not reach the server. Check your connection and try again." : "Something went wrong."
  }

  switch (body._tag) {
    case "UsernameAlreadyInUse":
      return `The username “${body.username}” is already taken.`
    case "InvalidCredentials":
      return "That username and password combination doesn’t match an account."
    case "Unauthorized":
      return "Your session has expired. Please sign in again."
    case "TooManyRequests":
      return `Too many attempts. For account safety this device is paused — try again in ${formatWait(body.retryAfterSeconds)}.`
    case "PayloadTooLarge":
      // Unreachable from the app's own forms — the fields are far shorter than
      // the limit — so this is only worth wording for a client that isn't ours.
      return "That request was too large to process."
    case "HttpApiDecodeError":
      // The backend validates the same rules the form does, so this only shows up
      // when the two drift apart — surface the server's own wording in that case.
      return body.issues[0]?.message ?? body.message
  }
}

/**
 * Turns openapi-fetch's `{ data, error }` result into a value, throwing a
 * normalised `ApiError` otherwise. TanStack Query treats the throw as a failure,
 * so components only ever deal with `data` plus an `ApiError`.
 */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || result.data === undefined) {
    const body = hasTag(result.error) ? result.error : undefined
    throw new ApiError(messageFor(result.error, result.response.status), result.response.status, body)
  }
  return result.data
}

/** Wraps a thrown network error (fetch rejection) in the same `ApiError` shape. */
export async function request<T>(run: () => Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  try {
    return unwrap(await run())
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0)
  }
}

export const api = {
  register: (payload: RegisterPayload) => request(() => client.POST("/auth/register", { body: payload })),
  login: (payload: LoginPayload) => request(() => client.POST("/auth/login", { body: payload })),
  me: () => request(() => client.GET("/users/me")),
  health: () => request(() => client.GET("/health"))
}
