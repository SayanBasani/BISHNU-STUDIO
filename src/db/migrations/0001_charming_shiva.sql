CREATE TABLE `authentication_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`event_type` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`status` text DEFAULT 'success' NOT NULL,
	`failure_reason` text,
	`metadata_json` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `user_addresses` ADD `recipient_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_addresses` ADD `recipient_phone` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_addresses` ADD `address_type` text DEFAULT 'home' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_addresses` ADD `landmark` text;