ALTER TABLE `shop_settings` ADD `is_open` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `shop_settings` ADD `closed_message` text DEFAULT 'We are currently closed for new orders. Store browsing and existing order tracking remain active.';--> statement-breakpoint
ALTER TABLE `shop_settings` ADD `return_policy_notice` text DEFAULT 'Items can be returned within 7 days of delivery. Custom printed documents and smart cards are non-returnable once produced.';--> statement-breakpoint
ALTER TABLE `shop_settings` ADD `return_window_days` integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE `shop_settings` ADD `customer_fulfillment_note` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_person_name` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_person_phone` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking_url` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `expected_delivery_date` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `customer_fulfillment_note` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `fulfillment_status` text DEFAULT 'unfulfilled' NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `order_returns` (
	`id` text PRIMARY KEY NOT NULL,
	`return_reference` text NOT NULL UNIQUE,
	`order_id` text NOT NULL REFERENCES `orders`(`id`) ON DELETE cascade,
	`customer_id` text NOT NULL REFERENCES `users`(`id`),
	`status` text DEFAULT 'requested' NOT NULL,
	`reason` text NOT NULL,
	`customer_description` text NOT NULL,
	`requested_resolution` text DEFAULT 'refund' NOT NULL,
	`evidence_urls_json` text,
	`pickup_method` text DEFAULT 'courier_pickup' NOT NULL,
	`courier_name` text,
	`tracking_number` text,
	`tracking_url` text,
	`delivery_person_name` text,
	`delivery_person_phone` text,
	`expected_pickup_date` text,
	`rejection_reason` text,
	`customer_instructions` text,
	`internal_notes` text,
	`inspection_result` text,
	`inspection_notes` text,
	`refund_amount` real,
	`refund_method` text,
	`refund_transaction_reference` text,
	`refund_processed_at` integer,
	`restocked` integer DEFAULT 0 NOT NULL,
	`restocked_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `order_return_items` (
	`id` text PRIMARY KEY NOT NULL,
	`return_id` text NOT NULL REFERENCES `order_returns`(`id`) ON DELETE cascade,
	`order_item_id` text NOT NULL REFERENCES `order_items`(`id`),
	`product_id` text REFERENCES `products`(`id`),
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price_snapshot` real NOT NULL,
	`total_price_snapshot` real NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
