import { db } from "../src/db/index";
import { sql } from "drizzle-orm";

async function count() {
  const tables = [
    "users",
    "user_addresses",
    "sessions",
    "verification_tokens",
    "product_categories",
    "products",
    "product_images",
    "services",
    "service_options",
    "service_prices",
    "orders",
    "order_items",
    "order_files",
    "payments",
    "audit_logs",
    "authentication_events",
    "shop_settings",
    "payment_submissions",
    "order_status_history",
    "account_appeals",
    "product_reviews",
    "shop_upi_accounts",
    "developer_profile",
  ];

  console.log("=== SQLITE DATABASE INVENTORY (./data/bishnu.db) ===");
  for (const t of tables) {
    try {
      const res: any = await db.run(sql.raw(`SELECT count(*) as count FROM ${t}`));
      const cnt = res.rows ? res.rows[0].count : (res[0]?.count ?? 0);
      console.log(`${t.padEnd(25)}: ${cnt}`);
    } catch (e: any) {
      console.log(`${t.padEnd(25)}: Error: ${e.message}`);
    }
  }
}

count().catch(console.error);
