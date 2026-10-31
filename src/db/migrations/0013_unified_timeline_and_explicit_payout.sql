ALTER TABLE `order_status_history` ADD COLUMN `event_type` text;
ALTER TABLE `order_status_history` ADD COLUMN `return_id` text;
ALTER TABLE `order_returns` ADD COLUMN `is_archived` integer DEFAULT 0 NOT NULL;
ALTER TABLE `order_returns` ADD COLUMN `archived_at` integer;
CREATE INDEX IF NOT EXISTS `idx_order_status_history_event_type` ON `order_status_history` (`event_type`);
CREATE INDEX IF NOT EXISTS `idx_order_status_history_return_id` ON `order_status_history` (`return_id`);
CREATE INDEX IF NOT EXISTS `idx_order_returns_archived` ON `order_returns` (`is_archived`);
