ALTER TABLE `sessions` ADD `credential_version` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `user_agent` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `ip_address` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `last_active_at` integer;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient_type` text NOT NULL,
	`recipient_id` text REFERENCES `users`(`id`) ON DELETE cascade,
	`category` text DEFAULT 'system' NOT NULL,
	`event_type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`link_url` text,
	`is_read` integer DEFAULT 0 NOT NULL,
	`read_at` integer,
	`priority` text DEFAULT 'normal' NOT NULL,
	`deduplication_key` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
