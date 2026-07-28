# planq

A TypeScript + [Bun](https://bun.com) + [Effect](https://effect.website) API with user registration/login, backed by SQLite via [Drizzle](https://orm.drizzle.team), with Swagger/OpenAPI docs generated from the `@effect/platform` `HttpApi` definition.

The product it backs is shift planning for hospitals, clinics and care teams. Registration, sign-in and the account view are what exist so far; rostering itself is not built yet.

`web/` holds the browser client — a React + TanStack Router SPA whose API types are generated from this API's own OpenAPI document. See [`web/README.md`](web/README.md).

## Setup

```bash
bun install
cp .env.example .env
```

`JWT_SECRET` must be set to a real secret outside of tests — the server refuses to start without it (no insecure default).

## Run

```bash
bun run dev     # watch mode
bun run start   # one-off
```

The server listens on `PORT` (default `3000`). Swagger UI is served at `/docs`.

`CORS_ORIGINS` is an optional comma-separated allowlist of browser origins (e.g. `http://localhost:5173,https://app.example.com`). When it is unset, all origins are allowed — fine locally, worth pinning in production.

To run the frontend alongside it:

```bash
cd web && bun install && bun run dev   # http://localhost:5173, proxies /api to :3000
```

## Security response headers

Every response carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` and a `Content-Security-Policy` (`src/api/SecurityHeaders.ts`). The policy is `default-src 'none'` for JSON responses; the `/docs` page gets a relaxed one because Swagger UI is inlined into it, which is one more reason not to serve `/docs` in production.

The frontend is a separate origin with its own policy — see [`web/README.md`](web/README.md).

### `Strict-Transport-Security` is not one of them

**Set HSTS at whatever terminates TLS**, not here. The app can't see the browser's scheme from behind a terminating proxy without being told to trust `X-Forwarded-Proto`, which a client can forge; and a `max-age` sent by mistake pins clients to HTTPS for its full duration with no way to withdraw it early. The terminator knows the scheme for certain. nginx, for a proxy that owns TLS for both the API and the frontend:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

### Behind a reverse proxy

The headers above are sent by the app, so they reach the browser whether or not a proxy is in front — [`docker-compose.yml`](docker-compose.yml) publishes the API port directly and has no proxy at all.

If your proxy also sets them, **do not simply set them in both places.** nginx's `add_header` adds to what came from upstream rather than replacing it, so you get two of each, and duplicates are not benign:

| Duplicated header         | What the browser does                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy` | Enforces both policies independently, so the effective policy is their intersection. A policy written for the SPA will break `/docs`. |
| `X-Frame-Options`         | Conflicting values are handled inconsistently across browsers.                                                                        |

Either drop them from the proxy config and let the app own them, or hide the app's and own them at the proxy:

```nginx
proxy_hide_header Content-Security-Policy;
proxy_hide_header X-Frame-Options;
proxy_hide_header X-Content-Type-Options;
proxy_hide_header Referrer-Policy;
```

Owning them at the proxy costs you the per-route CSP split — `default-src 'none'` on JSON but a relaxed policy on the `/docs` HTML — which the app does by response `Content-Type` and a proxy can only approximate.

`TRUST_PROXY=true` is a separate matter and still worth setting behind a proxy: it is what makes the rate limiter read `X-Forwarded-For` instead of bucketing every client under the proxy's own address.

## Endpoints

- `GET /health` — `{ status: "ok" }`
- `POST /auth/register` — `{ username, password }` -> `{ token, user }`
- `POST /auth/login` — `{ username, password }` -> `{ token, user }`
- `GET /users/me` — requires `Authorization: Bearer <token>` -> `user`

## Scripts

- `bun run test` — `bun test`
- `bun run typecheck` — `tsc --noEmit`
- `bun run lint` / `bun run lint:fix` — ESLint
- `bun run format` / `bun run format:check` — Prettier
- `bun run openapi:generate` — write the OpenAPI document for the `HttpApi` definition to `web/api.json` (run after any change under `src/api` or `src/domain`, then `cd web && bun run api:types`)
- `bun run db:generate` — generate a new SQL migration from `src/db/schema.ts` into `drizzle/`
- `bun run db:studio` — browse the database with Drizzle Studio

## Project layout

- `src/domain` — Effect `Schema` models and auth helpers (password hashing via `Bun.password`, JWT via `jose`)
- `src/db` — Drizzle schema (`schema.ts`) and the `Db` service/layer (`Database.ts`), backed by `bun:sqlite`
- `drizzle/` — SQL migrations generated by `drizzle-kit`, applied automatically on startup via `drizzle-orm`'s migrator
- `src/api` — `HttpApi` definition, bearer-auth middleware, and endpoint handlers
- `src/api/ApiLive.ts` — the fully-implemented API layer (handlers + auth middleware + JWT config), shared by `Server.ts` and the integration tests
- `src/api/SecurityHeaders.ts` — the security response headers and the two CSPs (JSON, and the Swagger UI document)
- `src/Server.ts` — composes the API layer with the database and starts the Bun HTTP server
- `test/domain` — unit tests for schema validation and auth helpers
- `test/api.test.ts` — integration tests that exercise the full HTTP API in-process (`HttpApiBuilder.toWebHandler`) against an in-memory SQLite database, no network port involved
- `scripts/generate-openapi.ts` — writes `web/api.json` from the `HttpApi` definition
- `web/` — the React frontend (its own package; see [`web/README.md`](web/README.md))
