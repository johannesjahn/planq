# planq

A TypeScript + [Bun](https://bun.com) + [Effect](https://effect.website) API with user registration/login, backed by SQLite, with Swagger/OpenAPI docs generated from the `@effect/platform` `HttpApi` definition.

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

## Project layout

- `src/domain` — Effect `Schema` models and auth helpers (password hashing via `Bun.password`, JWT via `jose`)
- `src/db` — SQLite client layer (`@effect/sql-sqlite-bun`) and schema setup
- `src/api` — `HttpApi` definition, bearer-auth middleware, and endpoint handlers
- `src/api/ApiLive.ts` — the fully-implemented API layer (handlers + auth middleware + JWT config), shared by `Server.ts` and the integration tests
- `src/Server.ts` — composes the API layer with the database and starts the Bun HTTP server
- `test/domain` — unit tests for schema validation and auth helpers
- `test/api.test.ts` — integration tests that exercise the full HTTP API in-process (`HttpApiBuilder.toWebHandler`) against an in-memory SQLite database, no network port involved
