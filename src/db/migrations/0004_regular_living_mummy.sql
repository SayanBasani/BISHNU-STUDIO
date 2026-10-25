ALTER TABLE `payment_submissions` ADD `is_duplicate_flagged` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_submissions` ADD `duplicate_notes` text;--> statement-breakpoint
ALTER TABLE `payment_submissions` ADD `submission_type` text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_submissions` ADD `idempotency_key` text;