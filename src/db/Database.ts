import { SqliteClient } from "@effect/sql-sqlite-bun"
import { Config, Effect, Layer } from "effect"

export const SqlLive = SqliteClient.layerConfig({
  filename: Config.string("DB_FILENAME").pipe(Config.withDefault("planq.sqlite"))
})

const setupSchema = Effect.gen(function* () {
  const sql = yield* SqliteClient.SqliteClient
  yield* sql`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `
})

export const DatabaseLive = Layer.provideMerge(Layer.effectDiscard(setupSchema), SqlLive)
