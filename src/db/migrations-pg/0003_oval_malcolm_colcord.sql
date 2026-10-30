CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_type" text NOT NULL,
	"recipient_id" text,
	"category" text DEFAULT 'system' NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"link_url" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" bigint,
	"priority" text DEFAULT 'normal' NOT NULL,
	"deduplication_key" text,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "credential_version" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "ip_address" text;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "last_active_at" bigint;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;