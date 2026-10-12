CREATE TABLE `app_control` (
	`singleton` integer PRIMARY KEY NOT NULL,
	`maintenance` integer DEFAULT 0 NOT NULL,
	`reset_id` text,
	`started_at` integer
);
--> statement-breakpoint
CREATE TABLE `reset_room_snapshots` (
	`reset_id` text NOT NULL,
	`room_id` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reset_session_snapshots` (
	`reset_id` text NOT NULL,
	`session_id` text NOT NULL,
	`active_room` text NOT NULL,
	`controller` text,
	`lease` integer NOT NULL,
	`seen` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reset_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	`room_count` integer NOT NULL,
	`session_count` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `rooms` ADD `last_human_activity_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `expires_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `activity_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
/* Legacy rooms use their authoritative state.created value. Only malformed
   legacy rows fall back to the persisted updated timestamp; migration time is
   deliberately never treated as human activity. */
UPDATE `rooms`
SET `last_human_activity_at` = coalesce(cast(json_extract(`state`, '$.created') AS integer), `updated`),
    `expires_at` = coalesce(cast(json_extract(`state`, '$.created') AS integer), `updated`) + 21600000;--> statement-breakpoint
INSERT INTO `app_control` (`singleton`, `maintenance`) VALUES (1, 0);
