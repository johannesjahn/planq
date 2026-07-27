# syntax=docker/dockerfile:1

# Bun runs the TypeScript sources directly (no tsc build step — see
# "start": "bun run src/Server.ts" in package.json and noEmit in tsconfig.json),
# so this only needs a deps stage and a release stage, no compile stage.

FROM oven/bun:1.3.14 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS release
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
# Migrations are applied at process startup by DatabaseLive (see
# src/db/Database.ts), resolved relative to that file via import.meta.url —
# this must stay at ./drizzle relative to WORKDIR for that resolution to hold.
COPY drizzle ./drizzle

# /app/data is a volume mount point for the sqlite file (see docker-compose.yml);
# creating it with bun:bun ownership here so a fresh named volume inherits it,
# since the non-root `bun` user below otherwise can't write to a root-owned mount.
RUN mkdir -p /app/data && chown -R bun:bun /app
USER bun

EXPOSE 3000

# JWT_SECRET has no default outside NODE_ENV=test and must be supplied at
# `docker run` time, e.g. -e JWT_SECRET=... ; the process fails fast without it.
# DB_FILENAME defaults to ./planq.sqlite (relative to WORKDIR); mount a volume
# and point DB_FILENAME at a path inside it for data to survive container recreation.

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "process.exit((await fetch('http://localhost:' + (process.env.PORT ?? 3000) + '/health')).ok ? 0 : 1)"

CMD ["bun", "run", "src/Server.ts"]
