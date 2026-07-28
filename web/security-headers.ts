/**
 * The security response headers this app should be served with, in one place so
 * the dev server, `vite preview` and whatever serves `dist/` in production all
 * agree.
 *
 * The token this app holds lives in `localStorage` (see
 * `src/features/auth/session-storage.ts`), which is a deliberate choice for a
 * bearer-token API on a separate origin — but it also means no `httpOnly` flag
 * is protecting it. Any script that runs on this page can read it, and a stolen
 * token is valid for two hours with nothing on the server able to revoke it. CSP
 * is the substitute defence, and it has to block both legs of that attack:
 * `script-src 'self'` stops the injected script running, `connect-src` stops it
 * shipping the token anywhere.
 *
 * `dist/` is static files, so whatever fronts them — nginx, Caddy, Netlify,
 * S3+CloudFront — is where these belong in production. `vite.config.ts` also
 * inlines the CSP into `index.html` as a `<meta>` tag at build time, so a host
 * that sets no headers still gets the script and connect restrictions. The
 * headers below are the full set; the meta tag can only carry part of it (see
 * `contentSecurityPolicyMeta`).
 */

export interface PolicyOptions {
  /**
   * `VITE_API_BASE_URL`, when the build talks to an API on another origin.
   * Unset means the API is same-origin (the dev proxy, or a reverse proxy in
   * front of both), and `'self'` already covers it.
   */
  readonly apiBaseUrl?: string | undefined
  /** Relax the policy for the things only the Vite dev server does. */
  readonly dev?: boolean | undefined
}

/**
 * The origin to add to `connect-src`. A relative `VITE_API_BASE_URL` (the `/api`
 * default) is same-origin and needs nothing; anything else contributes its
 * origin, not its path, because that is the granularity CSP works at.
 */
const apiOrigin = (apiBaseUrl: string | undefined): string | undefined => {
  if (apiBaseUrl === undefined || apiBaseUrl.length === 0) return undefined
  try {
    return new URL(apiBaseUrl).origin
  } catch {
    return undefined
  }
}

export function contentSecurityPolicy({ apiBaseUrl, dev = false }: PolicyOptions = {}): string {
  const directives: Record<string, ReadonlyArray<string>> = {
    "default-src": ["'self'"],
    // The build emits an external module script and nothing inline, so this stays
    // tight — which is the directive doing the actual work here. The dev server
    // injects the React Refresh preamble inline, hence the relaxation.
    "script-src": dev ? ["'self'", "'unsafe-inline'"] : ["'self'"],
    // `'unsafe-inline'` is unavoidable: React `style` props and `motion`'s
    // animations both write inline `style` attributes on every frame. Splitting
    // this into `style-src-elem`/`style-src-attr` would be tighter, but browsers
    // that don't know those directives fall back to `style-src` and would block
    // the attributes outright — a policy that breaks the UI only on older
    // browsers is worse than one honest `'unsafe-inline'`.
    "style-src": ["'self'", "'unsafe-inline'"],
    // `data:` is for the SVG noise texture in `src/index.css`.
    "img-src": ["'self'", "data:"],
    "font-src": ["'self'"],
    // HMR runs over a WebSocket in development only.
    "connect-src": ["'self'", ...(apiOrigin(apiBaseUrl) ?? []), ...(dev ? ["ws:", "wss:"] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"]
  }

  return Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ")
}

/**
 * The same policy with the directives a `<meta http-equiv>` tag cannot express
 * removed. `frame-ancestors` is ignored there — the browser logs a warning and
 * carries on — so clickjacking protection genuinely does need a response header
 * from whatever serves the files.
 */
export function contentSecurityPolicyMeta(policy: string): string {
  return policy
    .split("; ")
    .filter((directive) => !directive.startsWith("frame-ancestors"))
    .join("; ")
}

/**
 * `Strict-Transport-Security` is not here on purpose: it belongs to the origin,
 * not the app, and a `max-age` sent by mistake cannot be withdrawn before it
 * expires. Set it at the TLS terminator, once TLS is actually in front.
 */
export function securityHeaders(policy: string): Record<string, string> {
  return {
    "Content-Security-Policy": policy,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer"
  }
}
