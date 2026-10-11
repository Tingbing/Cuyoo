CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`capacity` integer NOT NULL,
	`status` text NOT NULL,
	`state` text NOT NULL,
	`version` integer NOT NULL,
	`mutation` text NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `room_updated` ON `rooms` (`updated`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`active_room` text,
	`controller` text,
	`lease` integer DEFAULT 0 NOT NULL,
	`seen` integer NOT NULL,
	`created` integer NOT NULL,
	`rate_at` integer DEFAULT 0 NOT NULL,
	`rate_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `session_room` ON `sessions` (`active_room`);