# planq

TypeScript + Bun + Effect API. User register/login backed by SQLite, Swagger/OpenAPI docs auto-generated from the `HttpApi` definition. ESLint + Prettier configured.

## Run / check

```bash
bun run dev         # start with --watch
bun run start        # start once
bun run test          # bun test
bun run typecheck    # tsc --noEmit
bun run lint         # eslint .
bun run format       # prettier --write .
```

Env vars (see `.env.example`): `PORT` (default 3000), `DB_FILENAME` (default `planq.sqlite`), `JWT_SECRET` (**required** outside `NODE_ENV=test` — the server fails to start without it, see gotcha below).

## File map

- `src/domain/User.ts` — Effect `Schema.Class` models: `User` (`id`, `username`, `createdAt`), `RegisterPayload`, `LoginPayload` (both `username`+`password`, no email). Tagged errors `UsernameAlreadyInUse` (409), `InvalidCredentials` (401), `Unauthorized` (401), status set via `HttpApiSchema.annotations({ status })` as the 3rd arg to `Schema.TaggedError`.
- `src/domain/Auth.ts` — `CurrentUser` (`Context.Tag`), `JwtConfig` (+ `JwtConfigLive` reading `JWT_SECRET`, no default outside tests), `hashPassword`/`verifyPassword`/`verifyPasswordConstantTime` (`Bun.password`, argon2id; cost params turned down under `NODE_ENV=test`), `signToken`/`verifyToken` (`jose`, HS256, 2h expiry).
- `src/db/Database.ts` — `SqlLive` = `SqliteClient.layerConfig({ filename })`; `DatabaseLive` merges in a `CREATE TABLE IF NOT EXISTS users` bootstrap effect. `created_at` defaults to `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')` (real ISO 8601 UTC, not SQLite's bare `datetime('now')` which omits `T`/`Z`). No file-based migrator (skipped `@effect/sql-sqlite-bun`'s `SqliteMigrator` — needs FileSystem/Path/CommandExecutor wiring that isn't worth it for one table).
- `src/api/Api.ts` — the `HttpApi` definition: `HealthGroup` (`GET /health`), `AuthGroup` (`POST /auth/register`, `POST /auth/login`), `UsersGroup` (`GET /users/me`, `.middleware(Authorization)`).
- `src/api/AuthMiddleware.ts` — `Authorization` = `HttpApiMiddleware.Tag` with `security: { bearer: HttpApiSecurity.bearer }`, provides `CurrentUser`, fails with `Unauthorized`. `AuthorizationLive` resolves `JwtConfig` once at layer-build time and closes over it — see gotcha below.
- `src/api/AuthLive.ts` — register relies on the `users.username` `UNIQUE` constraint (catches the constraint-violation `SqlError` and maps it to `UsernameAlreadyInUse`) rather than a check-then-insert `SELECT`, which would race under concurrent registrations for the same username (verified: pre-fix, concurrent duplicate registrations could 500 instead of 409).
- `src/api/UsersLive.ts` / `src/api/HealthLive.ts` — remaining `HttpApiBuilder.group(Api, "<name>", handlers => handlers.handle(...))` implementations. Raw SQL via `SqliteClient`'s tagged-template `sql` fn (no ORM/migrator).
- `src/api/ApiLive.ts` — `HttpApiBuilder.api(Api)` with `AuthLive`/`UsersLive`/`HealthLive`/`AuthorizationLive`/`JwtConfigLive` provided. Extracted out of `Server.ts` so `test/api.test.ts` can reuse the exact same handler wiring (only swapping in an in-memory DB) instead of duplicating the composition.
- `src/Server.ts` — provides `ApiLive` and `DatabaseLive` into `HttpApiBuilder.serve(...)` + `HttpApiSwagger.layer({ path: "/docs" })` + `BunHttpServer.layer({ port })`, then `BunRuntime.runMain(Layer.launch(HttpLive))`.
- `test/domain/*.test.ts` — unit tests: `Schema.decodeUnknownSync` for payload validation, `Effect.runPromise`/`Effect.runPromiseExit` for the password/JWT helpers.
- `test/api.test.ts` — integration test built on `HttpApiBuilder.toWebHandler`, see gotcha below.
- `.github/workflows/ci.yml` — runs `format:check`, `lint`, `typecheck`, `test` via `oven-sh/setup-bun` on push/PR to `main`.

## Gotchas hit while building this (don't re-derive)

- **TypeScript is pinned to `5.9.3`**, not the `7.x` that `bun add typescript` installs by default. `typescript-eslint` (as of this writing) hard-errors on TS 7 ("does not support TS 7.0"). If tooling upgrades to support it, fine to bump — otherwise leave pinned.
- **`SqlError` must not leak into `HttpApiEndpoint` error channels.** Endpoints only declare `UsernameAlreadyInUse`/`InvalidCredentials`/`Unauthorized` as errors; DB failures are infrastructure defects, not domain errors. Every handler ends with `.pipe(Effect.catchTag("SqlError", Effect.die))` to convert them to defects (→ generic 500) instead of type-checking as a declared error.
- **`HttpApiMiddleware.Tag` security handlers get _no_ extra context** — the `bearer: (token) => Effect<...>` function's requirement type is pinned to `HttpRouter.HttpRouter.Provided`, so it can't `yield*` a service like `JwtConfig` directly. Fix used here: build the handler inside `Layer.effect(Authorization, Effect.gen(...))`, resolve `JwtConfig` there (that's the _layer's_ R, satisfied when the layer is composed), and close over the resolved value / use `Effect.provideService` inside the returned closure.
- **`BunHttpServer.layerConfig({ port: Config... })` does not type-check** — `ServeOptions` is a union (`Bun.ServeOptions | TLSServeOptions | ...`) and `Config.Wrap` doesn't distribute over it cleanly, so TS infers `Config<any>` for the whole options object instead of per-field wrapping. Worked around by reading `PORT` from `process.env` directly and passing a plain literal to `BunHttpServer.layer({ port })` — simpler anyway since this is one-time startup config, not a value needed at effect runtime.
- **Effect version**: `Schema` lives in `effect/Schema` (bundled into the `effect` package since 3.x) — there is no separate `@effect/schema` install.
- The OpenAPI JSON is not served at a separate `/docs/openapi.json` route — `HttpApiSwagger.layer()` embeds the spec inline in the `/docs` HTML page (`spec: {...}` in the bundled JS). If a standalone JSON endpoint is ever needed, generate it explicitly with `OpenApi.fromApi(Api)` rather than assuming a URL.
- **`HttpApiBuilder.toWebHandler(layer)` requires its `layer` argument to _output_ `HttpRouter.HttpRouter.DefaultServices`, not merely have them internally satisfied.** `Layer.provide` (or `Layer.mergeAll`, which doesn't wire dependencies between merged layers at all) is the wrong tool here. `test/api.test.ts` builds `Layer.merge(ApiLive.pipe(Layer.provide(DatabaseLive)), BunHttpServer.layerContext)`: `Layer.provide` feeds `DatabaseLive`'s `SqliteClient` output into `ApiLive`'s requirement (output stays just `Api`), then `Layer.merge` unions that with `BunHttpServer.layerContext`'s output (`HttpPlatform`/`Etag.Generator`/`BunContext`) so both are visible to `toWebHandler`.
- `toWebHandler` builds its layer/runtime **once**, lazily, on the first `handler()` call, and reuses it (via an internal `Scope`) until `dispose()` is called — confirmed by reading `HttpApp.toWebHandlerLayerWith` in `node_modules`. This is what makes an in-memory SQLite DB (`DB_FILENAME=":memory:"`) work as shared state across sequential requests within one test file.
- **`JWT_SECRET` has no default outside `NODE_ENV=test`** — `Auth.ts` branches on `process.env.NODE_ENV === "test"` (which `bun test` sets automatically) to supply a fixed test secret; every other environment requires the real env var or the app fails to start with a `ConfigError` (`Missing data at JWT_SECRET`). Verified by running the server with a stripped env from a different cwd (so Bun's automatic `.env` autoload can't find the project's `.env`).
- **Password hashing cost is also turned down under `NODE_ENV=test`** (`memoryCost: 19, timeCost: 1` vs Bun's real argon2id defaults) — cut the test suite from ~900ms to ~250ms. Don't "fix" this by using the same cost in both — that's the point.
- **ESLint uses `tseslint.configs.recommendedTypeChecked`** (via `projectService: true` in `eslint.config.mjs`), not the plain `recommended` set — it needs a real tsconfig to type-check against, which is why it caught `bun-types`' `expect(...).rejects.toBeDefined()` being typed as returning `void` instead of a `Promise` (a real mistyping in `bun-types`, not a bug in the test). Worked around in `test/domain/auth.test.ts` by asserting on `Effect.runPromiseExit(...)` instead of `.rejects`, which is also more idiomatic for testing Effect programs.
