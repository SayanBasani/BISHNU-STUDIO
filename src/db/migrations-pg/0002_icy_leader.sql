CREATE TABLE "order_return_items" (
	"id" text PRIMARY KEY NOT NULL,
	"return_id" text NOT NULL,
	"order_item_id" text NOT NULL,
	"product_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_snapshot" double precision NOT NULL,
	"total_price_snapshot" double precision NOT NULL,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_returns" (
	"id" text PRIMARY KEY NOT NULL,
	"return_reference" text NOT NULL,
	"order_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"reason" text NOT NULL,
	"customer_description" text NOT NULL,
	"requested_resolution" text DEFAULT 'refund' NOT NULL,
	"evidence_urls_json" text,
	"pickup_method" text DEFAULT 'courier_pickup' NOT NULL,
	"courier_name" text,
	"tracking_number" text,
	"tracking_url" text,
	"delivery_person_name" text,
	"delivery_person_phone" text,
	"expected_pickup_date" text,
	"rejection_reason" text,
	"customer_instructions" text,
	"internal_notes" text,
	"inspection_result" text,
	"inspection_notes" text,
	"refund_amount" double precision,
	"refund_method" text,
	"refund_transaction_reference" text,
	"refund_processed_at" bigint,
	"restocked" boolean DEFAULT false NOT NULL,
	"restocked_at" bigint,
	"created_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	"updated_at" bigint DEFAULT (EXTRACT(epoch FROM now()) * 1000)::bigint NOT NULL,
	CONSTRAINT "order_returns_return_reference_unique" UNIQUE("return_reference")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_person_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_person_phone" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "expected_delivery_date" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "customer_fulfillment_note" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fulfillment_status" text DEFAULT 'unfulfilled' NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN "is_open" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN "closed_message" text DEFAULT 'We are currently closed for new orders. Store browsing and existing order tracking remain active.';--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN "return_policy_notice" text DEFAULT 'Items can be returned within 7 days of delivery. Custom printed documents and smart cards are non-returnable once produced.';--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN "return_window_days" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_settings" ADD COLUMN "customer_fulfillment_note" text;--> statement-breakpoint
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_return_id_order_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."order_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_return_items" ADD CONSTRAINT "order_return_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_returns" ADD CONSTRAINT "order_returns_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;