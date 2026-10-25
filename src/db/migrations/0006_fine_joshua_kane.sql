CREATE TABLE `developer_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`developer_name` text DEFAULT 'Sayan (Antigravity Engineer)' NOT NULL,
	`professional_title` text DEFAULT 'Senior Full-Stack Engineer & Solutions Architect' NOT NULL,
	`biography` text DEFAULT 'Full-stack software engineer specializing in high-reliability e-commerce architectures, automated print pipelines, resilient payment workflows, and accessible responsive interfaces.' NOT NULL,
	`skills_json` text DEFAULT '["Next.js 14 (App Router)","TypeScript","Tailwind CSS","Drizzle ORM & LibSQL","UPI Payment Workflows","Serverless Architecture","REST & Edge APIs","PDF & Image Processing"]',
	`project_contribution` text DEFAULT 'Architected and implemented Bishnu Studio end-to-end: secure document upload pipelines, server-side dynamic pricing calculation, manual UPI reconciliation engine, verified product reviews, customer management with appeal processing, and full dark/light theme consistency.',
	`project_start_date` text DEFAULT '2024-01-15',
	`project_completion_date` text DEFAULT '2024-10-25',
	`portfolio_url` text,
	`github_url` text DEFAULT 'https://github.com',
	`linkedin_url` text DEFAULT 'https://linkedin.com',
	`contact_email` text DEFAULT 'developer@bishnustudio.com',
	`avatar_url` text,
	`credits_statement` text DEFAULT 'Website developed and maintained by Sayan (Antigravity Engineer) for Bishnu Studio. All rights reserved.',
	`is_published` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_by_user_id` text,
	FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `shop_upi_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`upi_id` text NOT NULL,
	`account_display_name` text NOT NULL,
	`merchant_name` text DEFAULT 'Bishnu Studio' NOT NULL,
	`qr_mode` text DEFAULT 'generated_upi_id' NOT NULL,
	`uploaded_qr_image_url` text,
	`payment_instructions` text,
	`is_active` integer DEFAULT true NOT NULL,
	`deactivated_at` integer,
	`internal_notes` text,
	`created_by_user_id` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `payment_submissions` ADD `receiving_account_id` text;--> statement-breakpoint
ALTER TABLE `payment_submissions` ADD `receiving_upi_id_snapshot` text;--> statement-breakpoint
ALTER TABLE `payment_submissions` ADD `receiving_account_name_snapshot` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `receiving_account_id` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `receiving_upi_id_snapshot` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `receiving_account_name_snapshot` text;--> statement-breakpoint
ALTER TABLE `payments` ADD `amount_verified` real;--> statement-breakpoint
ALTER TABLE `payments` ADD `verified_by_admin_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `payments` ADD `verified_at` integer;--> statement-breakpoint
ALTER TABLE `shop_settings` ADD `active_upi_account_id` text;