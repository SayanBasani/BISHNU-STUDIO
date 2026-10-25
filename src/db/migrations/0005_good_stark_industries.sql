CREATE TABLE `account_appeals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`contact_email` text NOT NULL,
	`contact_phone` text,
	`category` text DEFAULT 'mistake' NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`admin_decision` text,
	`admin_response_note` text,
	`reviewed_by_admin_id` text,
	`reviewed_at` integer,
	`ip_address` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by_admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `product_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`order_id` text,
	`rating` integer NOT NULL,
	`review_title` text,
	`review_text` text NOT NULL,
	`is_verified_purchase` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`moderation_reason` text,
	`moderated_by_admin_id` text,
	`moderated_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`moderated_by_admin_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `users` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `blocked_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `blocked_reason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `blocked_category` text;--> statement-breakpoint
ALTER TABLE `users` ADD `blocked_by_admin_id` text;