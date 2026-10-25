ALTER TABLE "orders" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "courier_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "dispatched_at" bigint;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivered_at" bigint;