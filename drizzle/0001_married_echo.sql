-- Hand-completed. `drizzle-kit generate` emitted
--   ALTER TABLE `users` ADD `username_lower` text NOT NULL;
-- which SQLite rejects outright (a NOT NULL column added via ALTER TABLE must have a
-- non-NULL default) and which would leave existing rows unpopulated regardless. The
-- table-recreation below is the same shape drizzle-kit generates for other column
-- changes, with `lower(username)` backfilling the new column.
--
-- `lower()` is ASCII-only in SQLite, which matches JavaScript's `toLowerCase()` over the
-- character set the Username schema allows (`[a-zA-Z0-9_]`).
--
-- The backfill cannot collide: the unique index this replaces was COLLATE NOCASE, so no
-- two existing usernames can already differ only by case. Dropping the old table drops
-- that index with it.
CREATE TABLE `__new_users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`username_lower` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`(`id`, `username`, `username_lower`, `password_hash`, `created_at`) SELECT `id`, `username`, lower(`username`), `password_hash`, `created_at` FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_lower_unique` ON `users` (`username_lower`);
