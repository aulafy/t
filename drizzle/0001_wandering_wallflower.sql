CREATE TABLE `request_windows` (
	`id` text PRIMARY KEY NOT NULL,
	`used` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `request_windows_expiry` ON `request_windows` (`expires_at`);