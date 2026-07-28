import { sql } from "drizzle-orm"
import { sqliteTable, text } from "drizzle-orm/sqlite-core"

// Usernames are case-insensitive: "johndoe" and "JohnDoe" are the same
// account, rather than two an attacker could register to impersonate a real
// user. `username` keeps the casing that was typed at registration (it is
// what /users/me returns); `username_lower` holds the normalised form and
// carries the UNIQUE index, so the invariant lives in a column drizzle-kit
// records in its snapshot rather than in a `COLLATE NOCASE` hand-edit it
// silently drops whenever it regenerates the table. Every write goes through
// `normalizeUsername` in src/domain/User.ts.
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull(),
  usernameLower: text("username_lower").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
})
