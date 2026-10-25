CREATE TABLE "account_appeals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"category" text DEFAULT 'mistake' NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"admin_decision" text,
	"admin_response_note" text,
	"reviewed_by_admin_id" text,
	"reviewed_at" bigint,
	"ip_address" text,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"details_json" text,
	"ip_address" text,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authentication_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"event_type" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"status" text DEFAULT 'success' NOT NULL,
	"failure_reason" text,
	"metadata_json" text,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "developer_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"developer_name" text DEFAULT 'Sayan (Antigravity Engineer)' NOT NULL,
	"professional_title" text DEFAULT 'Senior Full-Stack Engineer & Solutions Architect' NOT NULL,
	"biography" text DEFAULT 'Full-stack software engineer specializing in high-reliability e-commerce architectures, automated print pipelines, resilient payment workflows, and accessible responsive interfaces.' NOT NULL,
	"skills_json" text DEFAULT '["Next.js 14 (App Router)","TypeScript","Tailwind CSS","Neon PostgreSQL & Drizzle ORM","UPI Payment Workflows","Serverless Architecture","REST & Edge APIs","PDF & Image Processing"]',
	"project_contribution" text DEFAULT 'Architected and implemented Bishnu Studio end-to-end: secure document upload pipelines, server-side dynamic pricing calculation, manual UPI reconciliation engine, verified product reviews, customer management with appeal processing, and full dark/light theme consistency.',
	"project_start_date" text DEFAULT '2024-01-15',
	"project_completion_date" text DEFAULT '2024-10-25',
	"portfolio_url" text,
	"github_url" text DEFAULT 'https://github.com',
	"linkedin_url" text DEFAULT 'https://linkedin.com',
	"contact_email" text DEFAULT 'developer@bishnustudio.com',
	"avatar_url" text,
	"credits_statement" text DEFAULT 'Website developed and maintained by Sayan (Antigravity Engineer) for Bishnu Studio. All rights reserved.',
	"is_published" boolean DEFAULT true NOT NULL,
	"updated_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	"updated_by_user_id" text
);
--> statement-breakpoint
CREATE TABLE "order_files" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text,
	"order_item_id" text,
	"uploaded_by_user_id" text NOT NULL,
	"original_filename" text NOT NULL,
	"stored_filename" text NOT NULL,
	"storage_key" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"file_category" text NOT NULL,
	"page_count" integer,
	"retention_expires_at" bigint,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"item_type" text NOT NULL,
	"product_id" text,
	"service_id" text,
	"configuration_json" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"page_count" integer DEFAULT 1 NOT NULL,
	"unit_price_snapshot" double precision NOT NULL,
	"total_price_snapshot" double precision NOT NULL,
	"special_instructions" text,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"previous_status" text,
	"new_status" text NOT NULL,
	"previous_payment_status" text,
	"new_payment_status" text,
	"changed_by_user_id" text,
	"actor_role" text DEFAULT 'system' NOT NULL,
	"customer_message" text,
	"internal_note" text,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"order_reference" text NOT NULL,
	"customer_id" text NOT NULL,
	"order_type" text NOT NULL,
	"subtotal" double precision NOT NULL,
	"discount" double precision DEFAULT 0 NOT NULL,
	"additional_charges" double precision DEFAULT 0 NOT NULL,
	"total_amount" double precision NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"payment_method" text DEFAULT 'cash_on_collection' NOT NULL,
	"order_status" text DEFAULT 'pending' NOT NULL,
	"delivery_type" text DEFAULT 'store_pickup' NOT NULL,
	"order_notes" text,
	"internal_notes" text,
	"shipping_address_json" text,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "orders_order_reference_unique" UNIQUE("order_reference")
);
--> statement-breakpoint
CREATE TABLE "payment_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"amount" double precision NOT NULL,
	"payment_method" text DEFAULT 'upi' NOT NULL,
	"upi_id_used" text NOT NULL,
	"receiving_account_id" text,
	"receiving_upi_id_snapshot" text,
	"receiving_account_name_snapshot" text,
	"transaction_id" text NOT NULL,
	"screenshot_file_id" text,
	"screenshot_url" text,
	"status" text DEFAULT 'pending_verification' NOT NULL,
	"is_duplicate_flagged" boolean DEFAULT false NOT NULL,
	"duplicate_notes" text,
	"submission_type" text DEFAULT 'standard' NOT NULL,
	"idempotency_key" text,
	"rejection_reason" text,
	"rejection_note" text,
	"verified_by_admin_id" text,
	"verified_at" bigint,
	"verification_note" text,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"payment_provider" text NOT NULL,
	"transaction_reference" text,
	"amount" double precision NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" text NOT NULL,
	"receiving_account_id" text,
	"receiving_upi_id_snapshot" text,
	"receiving_account_name_snapshot" text,
	"amount_verified" double precision,
	"verified_by_admin_id" text,
	"verified_at" bigint,
	"payment_metadata_json" text,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "product_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"image_url" text NOT NULL,
	"alt_text" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"order_id" text,
	"rating" integer NOT NULL,
	"review_title" text,
	"review_text" text NOT NULL,
	"is_verified_purchase" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"moderation_reason" text,
	"moderated_by_admin_id" text,
	"moderated_at" bigint,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"price" double precision NOT NULL,
	"discounted_price" double precision,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"sku" text NOT NULL,
	"variants_json" text,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "service_options" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"option_group" text NOT NULL,
	"option_key" text NOT NULL,
	"option_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata_json" text,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_prices" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"option_id" text,
	"price" double precision NOT NULL,
	"unit" text NOT NULL,
	"min_quantity" integer DEFAULT 1 NOT NULL,
	"max_quantity" integer DEFAULT 1000 NOT NULL,
	"extra_charges_json" text,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "services_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_token" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "shop_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"shop_name" text DEFAULT 'Bishnu Studio' NOT NULL,
	"building" text DEFAULT '12/B Station Road' NOT NULL,
	"street" text DEFAULT 'Main Market' NOT NULL,
	"landmark" text DEFAULT 'Near Town Hall & Central Post Office',
	"city_town" text DEFAULT 'Barasat' NOT NULL,
	"state" text DEFAULT 'West Bengal' NOT NULL,
	"pin_code" text DEFAULT '700001' NOT NULL,
	"contact_phone" text DEFAULT '9876543210' NOT NULL,
	"contact_email" text DEFAULT 'support@bishnustudio.com' NOT NULL,
	"opening_hours" text DEFAULT 'Mon-Sat 8:00 AM - 9:30 PM, Sun 10:00 AM - 4:00 PM',
	"logo_url" text,
	"upi_enabled" boolean DEFAULT true NOT NULL,
	"merchant_name" text DEFAULT 'Bishnu Studio' NOT NULL,
	"upi_id" text DEFAULT 'bishnustudio@icici' NOT NULL,
	"active_upi_account_id" text,
	"qr_mode" text DEFAULT 'generated_upi_id' NOT NULL,
	"uploaded_qr_image_url" text,
	"payment_instructions" text DEFAULT 'Pay the exact order amount using the QR code or UPI ID below. After completing your payment in your UPI application, upload your payment screenshot and enter your transaction reference. The shop will verify the payment before confirming your order.',
	"updated_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	"updated_by_user_id" text
);
--> statement-breakpoint
CREATE TABLE "shop_upi_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"upi_id" text NOT NULL,
	"account_display_name" text NOT NULL,
	"merchant_name" text DEFAULT 'Bishnu Studio' NOT NULL,
	"qr_mode" text DEFAULT 'generated_upi_id' NOT NULL,
	"uploaded_qr_image_url" text,
	"payment_instructions" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"deactivated_at" bigint,
	"internal_notes" text,
	"created_by_user_id" text,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"recipient_name" text DEFAULT '' NOT NULL,
	"recipient_phone" text DEFAULT '' NOT NULL,
	"address_type" text DEFAULT 'home' NOT NULL,
	"label" text DEFAULT 'Home' NOT NULL,
	"house_building" text NOT NULL,
	"street_locality" text NOT NULL,
	"landmark" text,
	"city_town" text NOT NULL,
	"state" text NOT NULL,
	"pin_code" text NOT NULL,
	"is_default" boolean DEFAULT true NOT NULL,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'customer' NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"is_phone_verified" boolean DEFAULT false NOT NULL,
	"avatar_url" text,
	"password_updated_at" bigint,
	"status" text DEFAULT 'active' NOT NULL,
	"blocked_at" bigint,
	"blocked_reason" text,
	"blocked_category" text,
	"blocked_by_admin_id" text,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"token_hash" text NOT NULL,
	"type" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_appeals" ADD CONSTRAINT "account_appeals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_appeals" ADD CONSTRAINT "account_appeals_reviewed_by_admin_id_users_id_fk" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authentication_events" ADD CONSTRAINT "authentication_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_profile" ADD CONSTRAINT "developer_profile_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_files" ADD CONSTRAINT "order_files_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_files" ADD CONSTRAINT "order_files_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_files" ADD CONSTRAINT "order_files_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_screenshot_file_id_order_files_id_fk" FOREIGN KEY ("screenshot_file_id") REFERENCES "public"."order_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_submissions" ADD CONSTRAINT "payment_submissions_verified_by_admin_id_users_id_fk" FOREIGN KEY ("verified_by_admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_admin_id_users_id_fk" FOREIGN KEY ("verified_by_admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_moderated_by_admin_id_users_id_fk" FOREIGN KEY ("moderated_by_admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_options" ADD CONSTRAINT "service_options_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_prices" ADD CONSTRAINT "service_prices_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_prices" ADD CONSTRAINT "service_prices_option_id_service_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."service_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_upi_accounts" ADD CONSTRAINT "shop_upi_accounts_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_addresses" ADD CONSTRAINT "user_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;