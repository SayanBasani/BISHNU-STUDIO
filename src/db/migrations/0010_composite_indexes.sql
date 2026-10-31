CREATE INDEX IF NOT EXISTS `idx_notifications_recipient` ON `notifications` (`recipient_type`, `recipient_id`, `is_read`, `created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_notifications_dedup` ON `notifications` (`deduplication_key`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_orders_customer_created` ON `orders` (`customer_id`, `created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_orders_status` ON `orders` (`order_status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_orders_ref` ON `orders` (`order_reference`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_orders_created_at` ON `orders` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_order_items_order` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_order_items_product` ON `order_items` (`product_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_order_items_type` ON `order_items` (`item_type`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_order_files_order` ON `order_files` (`order_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_order_files_item` ON `order_files` (`order_item_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sessions_token` ON `sessions` (`session_token`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sessions_user_expires` ON `sessions` (`user_id`, `expires_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_product_reviews_prod_status` ON `product_reviews` (`product_id`, `status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_product_reviews_customer` ON `product_reviews` (`customer_id`, `product_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_user_addresses_user` ON `user_addresses` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_audit_logs_created` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_product_images_product` ON `product_images` (`product_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_payment_submissions_order` ON `payment_submissions` (`order_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_order_status_history_order` ON `order_status_history` (`order_id`);
