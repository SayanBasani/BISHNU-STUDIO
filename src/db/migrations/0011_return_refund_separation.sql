ALTER TABLE `order_returns` ADD `refund_status` text DEFAULT 'pending_review' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_returns` ADD `refund_destination_json` text;--> statement-breakpoint
ALTER TABLE `order_returns` ADD `refund_proof_url` text;--> statement-breakpoint
ALTER TABLE `order_returns` ADD `refund_disbursed_at` integer;--> statement-breakpoint
ALTER TABLE `order_returns` ADD `refund_disbursed_by_user_id` text;--> statement-breakpoint
ALTER TABLE `order_returns` ADD `refund_dispute_reason` text;--> statement-breakpoint
ALTER TABLE `order_returns` ADD `refund_disputed_at` integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_order_returns_refund_status` ON `order_returns` (`refund_status`);
