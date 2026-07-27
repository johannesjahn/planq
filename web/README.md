# planq web

The browser client for the planq API: a React + TanStack Router SPA built with Vite, styled with Tailwind CSS v4 and shadcn/ui components in a dark glassmorphic theme.

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
cd .. && JWT_SECRET=dev-secret bun run dev
```

For a build that talks to an API on a different origin, set `VITE_API_BASE_URL` (e.g. `https://api.example.com`) and add that origin's frontend to the API's `CORS_ORIGINS`.

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

## Notes on the design

- **Dark only, on purpose.** Frosted surfaces need a saturated backdrop to read as glass; there is no light theme rather than a bad one.
- **Motion is opt-out.** Everything decorative sits behind `prefers-reduced-motion`, and the cursor-tracking highlight is skipped entirely for reduced-motion and touch input.
- Sessions live in `localStorage` under `planq.session`. The stored user seeds the first paint; `/users/me` re-validates the token in the background and a 401 from anywhere clears the session.
