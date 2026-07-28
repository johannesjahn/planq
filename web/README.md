# planq web

The browser client for the planq API: a React + TanStack Router SPA built with Vite, styled with Tailwind CSS v4 and shadcn/ui components in a dark glassmorphic theme.

planq is positioned as shift planning for hospitals, clinics and care teams, so the copy addresses clinicians and rota administrators rather than developers. **Only registration, sign-in and the account view exist today** — the dashboard says so plainly instead of showing a placeholder rota that nobody should act on. Keep it that way: don't dress up unbuilt scheduling features as working ones.

It is a **separate package** from the API at the repository root — its own `package.json`, lockfile, tsconfig, ESLint and Prettier config. Run every command below from `web/`.

## Setup

```bash
bun install
cp .env.example .env   # optional; the defaults work for local development
```

## Run

```bash
bun run dev       # Vite dev server on http://localhost:5173
bun run build     # typecheck + production build into dist/
bun run preview   # serve the production build
```

`bun run dev` proxies `/api/*` to `http://localhost:3000` (override with `VITE_PROXY_TARGET`), so start the API first:

```bash
cd .. && bun run dev
```

That needs a `JWT_SECRET` of at least 32 characters in the root `.env` (Bun autoloads it) or the API will not start — see the root [`README.md`](../README.md#setup). Put it in the file rather than generating one per launch, or every restart invalidates the token you are signed in with.

For a build that talks to an API on a different origin, set `VITE_API_BASE_URL` (e.g. `https://api.example.com`) and add that origin's frontend to the API's `CORS_ORIGINS`. `VITE_API_BASE_URL` also has to be set at build time for the Content-Security-Policy below to allow the requests.

## Security headers

The session token lives in `localStorage`, so no `httpOnly` flag is protecting it: any script that runs on the page can read it, and a stolen token is good for two hours with nothing able to revoke it. The Content-Security-Policy is the substitute defence, and it blocks both halves of that attack — `script-src 'self'` stops an injected script running, `connect-src` stops it shipping the token to an attacker's origin.

`security-headers.ts` is the single definition, used three ways:

- `bun run dev` and `bun run preview` send the headers directly (`server.headers` / `preview.headers` in `vite.config.ts`), so a policy that breaks the app breaks it here rather than in production. Development gets two extra allowances that the build does not need: inline scripts (Vite's React Refresh preamble) and `ws:` (HMR).
- `vite build` inlines the policy into `dist/index.html` as a `<meta http-equiv="Content-Security-Policy">`, so a static host that sets no headers still enforces the script and connect restrictions.
- **In production, set the full set as response headers** on whatever serves `dist/` — nginx, Caddy, Netlify, CloudFront. `X-Frame-Options` and CSP's `frame-ancestors` cannot be expressed in a `<meta>` tag, so clickjacking protection needs a real header. `Strict-Transport-Security` belongs there too, alongside TLS termination.

`style-src` has to keep `'unsafe-inline'`: React `style` props and `motion`'s animations both write inline `style` attributes.

## The API contract

Nothing in this app hand-writes a request or response shape. The chain is:

```
src/api/Api.ts (HttpApi definition, repo root)
  → bun run openapi:generate   (at the repo root)  → web/api.json
  → bun run api:types          (here)              → web/src/lib/api.gen.ts
  → src/lib/api.ts                                 (typed openapi-fetch client)
```

Both `api.json` and `api.gen.ts` are committed, and CI fails if either is stale. After changing anything under the backend's `src/api` or `src/domain`:

```bash
cd .. && bun run openapi:generate
cd web && bun run api:types
```

## Layout

- `src/lib/api.ts` — typed `openapi-fetch` client, bearer-token middleware, and `ApiError` (normalises the API's tagged errors into messages the UI can show)
- `src/features/auth` — `AuthProvider` (session state + `/users/me` re-validation), the login and registration forms, and the shared auth layout
- `src/features/dashboard` — the signed-in view of the `/users/me` payload
- `src/components/ui` — shadcn/ui primitives (`components.json` is configured, so `bunx shadcn@latest add <component>` works)
- `src/components` — app-specific presentation: the aurora backdrop, the frosted panel with its cursor-tracking highlight, the brand mark
- `src/router.tsx` — the TanStack Router route tree, including the guards that bounce signed-out visitors to `/login` and signed-in ones away from it
- `src/index.css` — design tokens, the `glass` / `glass-subtle` utilities, and the keyframes
- `security-headers.ts` — the CSP and the rest of the security response headers, shared by the dev server, `vite preview` and the `<meta>` tag inlined into the build

## Notes on the design

- **Clinical palette.** Three raw tokens in `src/index.css` — `--azure` (primary), `--teal` (accent) and `--mint` — drive the aurora, the buttons and the avatar. Nothing else trends warm, which is what keeps amber and red meaningful when they appear.
- **Dark only, on purpose.** Frosted surfaces need a saturated backdrop to read as glass; there is no light theme rather than a bad one.
- **Motion is opt-out.** Everything decorative sits behind `prefers-reduced-motion`, and the cursor-tracking highlight is skipped entirely for reduced-motion and touch input.
- Sessions live in `localStorage` under `planq.session`. The stored user seeds the first paint; `/users/me` re-validates the token in the background and a 401 from anywhere clears the session.
