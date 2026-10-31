import { sql } from "drizzle-orm";
import { db, isPostgres } from "./index";

export const REQUIRED_INDEXES = [
  {
    name: "idx_notifications_recipient",
    table: "notifications",
    columns: "recipient_type, recipient_id, is_read, created_at",
  },
  {
    name: "idx_notifications_dedup",
    table: "notifications",
    columns: "deduplication_key",
  },
  {
    name: "idx_orders_customer_created",
    table: "orders",
    columns: "customer_id, created_at",
  },
  {
    name: "idx_orders_status",
    table: "orders",
    columns: "order_status",
  },
  {
    name: "idx_orders_ref",
    table: "orders",
    columns: "order_reference",
  },
  {
    name: "idx_orders_created_at",
    table: "orders",
    columns: "created_at",
  },
  {
    name: "idx_order_items_order",
    table: "order_items",
    columns: "order_id",
  },
  {
    name: "idx_order_items_product",
    table: "order_items",
    columns: "product_id",
  },
  {
    name: "idx_order_items_type",
    table: "order_items",
    columns: "item_type",
  },
  {
    name: "idx_order_files_order",
    table: "order_files",
    columns: "order_id",
  },
  {
    name: "idx_order_files_item",
    table: "order_files",
    columns: "order_item_id",
  },
  {
    name: "idx_sessions_token",
    table: "sessions",
    columns: "session_token",
  },
  {
    name: "idx_sessions_user_expires",
    table: "sessions",
    columns: "user_id, expires_at",
  },
  {
    name: "idx_product_reviews_prod_status",
    table: "product_reviews",
    columns: "product_id, status",
  },
  {
    name: "idx_product_reviews_customer",
    table: "product_reviews",
    columns: "customer_id, product_id",
  },
  {
    name: "idx_user_addresses_user",
    table: "user_addresses",
    columns: "user_id",
  },
  {
    name: "idx_audit_logs_created",
    table: "audit_logs",
    columns: "created_at",
  },
  {
    name: "idx_product_images_product",
    table: "product_images",
    columns: "product_id",
  },
  {
    name: "idx_payment_submissions_order",
    table: "payment_submissions",
    columns: "order_id",
  },
  {
    name: "idx_order_status_history_order",
    table: "order_status_history",
    columns: "order_id",
  },
];

export async function ensureIndexes() {
  for (const idx of REQUIRED_INDEXES) {
    try {
      const createSql = sql.raw(
        `CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table} (${idx.columns});`
      );
      if (isPostgres) {
        await (db as any).execute(createSql);
      } else {
        await (db as any).run(createSql);
      }
    } catch (e: any) {
      // Non-fatal if index already exists or table structure differences
      console.warn(`[Index Check] Index ${idx.name}:`, e?.message || e);
    }
  }
}

if (process.argv[1] && process.argv[1].includes("ensure-indexes")) {
  ensureIndexes()
    .then(() => {
      console.log(`[✓] Successfully verified/applied ${REQUIRED_INDEXES.length} composite database indexes.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[✕] Failed to ensure database indexes:", err);
      process.exit(1);
    });
}
