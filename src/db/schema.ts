import { sql } from "drizzle-orm"
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

// The `username` column is COLLATE NOCASE at the SQL level (see the
// generated migration) so "johndoe" and "JohnDoe" are the same account
// rather than two an attacker could register to impersonate a real user.
// drizzle-orm's sqlite-core column builder has no `.collate()` API, so this
// can't be expressed here — the migration file is the source of truth.
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
})
