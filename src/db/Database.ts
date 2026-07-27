import { Database as BunSqliteDatabase } from "bun:sqlite"
import { Config, Context, Effect, Layer } from "effect"
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite"
import { migrate } from "drizzle-orm/bun-sqlite/migrator"
import * as schema from "./schema.ts"

export class Db extends Context.Tag("Db")<Db, BunSQLiteDatabase<typeof schema>>() {}

export const DatabaseLive = Layer.scoped(
  Db,
  Effect.gen(function* () {
    const filename = yield* Config.string("DB_FILENAME").pipe(Config.withDefault("planq.sqlite"))
    const sqlite = yield* Effect.acquireRelease(
      Effect.sync(() => new BunSqliteDatabase(filename)),
      (db) => Effect.sync(() => db.close())
    )
    const db = drizzle(sqlite, { schema })
    yield* Effect.sync(() => migrate(db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname }))
    return db
  })
)
