CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`session` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `connection_session` ON `connections` (`session`);--> statement-breakpoint
ALTER TABLE `rooms` ADD `pre_v2_state` text;
--> statement-breakpoint
/* Private, one-time recovery checkpoint. Never exposed by the game API.
   Preserve original state before the schemaVersion 2 decoder runs. */
UPDATE rooms SET pre_v2_state=state WHERE pre_v2_state IS NULL;
