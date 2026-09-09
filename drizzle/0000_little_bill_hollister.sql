CREATE TABLE `changes` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`root_id` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`base_cents` integer NOT NULL,
	`tax_basis_points` integer NOT NULL,
	`tax_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`days` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`lock_version` integer DEFAULT 0 NOT NULL,
	`token_hash` text,
	`expires_at` text,
	`context_version` integer,
	`previous_cents` integer,
	`snapshot_hash` text,
	`decision_key` text,
	`decision_name` text,
	`decision_at` text,
	`decision_type` text,
	`decision_comment` text,
	`last_operation` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `changes_project` ON `changes` (`project_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `changes_token` ON `changes` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `changes_revision` ON `changes` (`root_id`,`revision`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`change_id` text NOT NULL,
	`kind` text NOT NULL,
	`actor` text NOT NULL,
	`at` text NOT NULL,
	`detail` text NOT NULL,
	`operation_id` text NOT NULL,
	FOREIGN KEY (`change_id`) REFERENCES `changes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_change` ON `events` (`change_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `events_operation` ON `events` (`operation_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`client` text NOT NULL,
	`budget_cents` integer NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `projects_owner` ON `projects` (`owner_id`);