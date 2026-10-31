import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { checkDatabaseReadiness, db, isPostgres } from "../db";
import { users, sessions, orders, products, notifications, userAddresses, orderFiles } from "../db/schema";
import { eq, desc, and } from "drizzle-orm";
import { validateSession } from "../lib/auth";
import { getNotifications } from "../lib/notifications";

async function runBenchmark() {
  console.log("=== BISHNU STUDIO PERFORMANCE DIAGNOSTIC BENCHMARK ===");
  console.log("Database Provider:", isPostgres ? "Neon PostgreSQL (Remote WAN)" : "SQLite/LibSQL (Local)");

  // 1. Database Ping (Cold vs Warm)
  const pingCold = await checkDatabaseReadiness();
  console.log("\n[1] Database Connectivity (SELECT 1 as ping):");
  console.log(`  - Cold Ping: ${pingCold.latencyMs} ms (ok: ${pingCold.ok})`);
  const pingWarm = await checkDatabaseReadiness();
  console.log(`  - Warm Ping: ${pingWarm.latencyMs} ms (ok: ${pingWarm.ok})`);

  // Find admin and customer user
  const adminUser = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
  const adminId = adminUser[0]?.id;
  const adminSession = adminId ? await db.select().from(sessions).where(eq(sessions.userId, adminId)).limit(1) : [];
  const adminToken = adminSession[0]?.sessionToken;

  console.log("\n[2] Session Validation & Authentication (/api/auth/me):");
  if (adminToken) {
    const t0 = performance.now();
    const sessionRes1 = await validateSession(adminToken);
    const authCold = performance.now() - t0;
    console.log(`  - Cold Auth Validation: ${authCold.toFixed(2)} ms (valid: ${!!sessionRes1})`);

    const t1 = performance.now();
    const sessionRes2 = await validateSession(adminToken);
    const authWarm = performance.now() - t1;
    console.log(`  - Warm Auth Validation: ${authWarm.toFixed(2)} ms`);
  }

  // 2. User Addresses Query (/api/account/addresses)
  console.log("\n[3] Saved Addresses Fetch (/api/account/addresses):");
  if (adminId) {
    const t0 = performance.now();
    const addrs1 = await db.select().from(userAddresses).where(eq(userAddresses.userId, adminId));
    const addrCold = performance.now() - t0;
    console.log(`  - Cold Address Fetch: ${addrCold.toFixed(2)} ms (count: ${addrs1.length})`);

    const t1 = performance.now();
    const addrs2 = await db.select().from(userAddresses).where(eq(userAddresses.userId, adminId));
    const addrWarm = performance.now() - t1;
    console.log(`  - Warm Address Fetch: ${addrWarm.toFixed(2)} ms`);
  }

  // 3. Notifications Query (/api/notifications)
  console.log("\n[4] Notifications Fetch (/api/notifications):");
  if (adminId) {
    const t0 = performance.now();
    const notifs1 = await getNotifications({ recipientType: "admin", recipientId: adminId, limit: 10 });
    const notifCold = performance.now() - t0;
    console.log(`  - Cold Notifications: ${notifCold.toFixed(2)} ms (items: ${notifs1.items.length}, unread: ${notifs1.unreadCount})`);

    const t1 = performance.now();
    const notifs2 = await getNotifications({ recipientType: "admin", recipientId: adminId, limit: 10 });
    const notifWarm = performance.now() - t1;
    console.log(`  - Warm Notifications: ${notifWarm.toFixed(2)} ms`);
  }

  // 4. Admin Metrics Aggregation (/api/admin/metrics)
  console.log("\n[5] Admin Metrics Aggregation (/api/admin/metrics):");
  const t0 = performance.now();
  const [metrics1, lowStock1, recentOrders1] = await Promise.all([
    db.select().from(orders).limit(10),
    db.select().from(products).limit(10),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8),
  ]);
  const metricsCold = performance.now() - t0;
  console.log(`  - Cold Concurrent Metrics: ${metricsCold.toFixed(2)} ms`);

  const t1 = performance.now();
  const [metrics2, lowStock2, recentOrders2] = await Promise.all([
    db.select().from(orders).limit(10),
    db.select().from(products).limit(10),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8),
  ]);
  const metricsWarm = performance.now() - t1;
  console.log(`  - Warm Concurrent Metrics: ${metricsWarm.toFixed(2)} ms`);

  // 5. File / Image Download Query (/api/files/download/[fileId])
  console.log("\n[6] File Metadata Lookup (/api/files/download):");
  const t0_f = performance.now();
  const files1 = await db.select().from(orderFiles).limit(1);
  const fileCold = performance.now() - t0_f;
  console.log(`  - Cold File Lookup: ${fileCold.toFixed(2)} ms`);

  const t1_f = performance.now();
  const files2 = await db.select().from(orderFiles).limit(1);
  const fileWarm = performance.now() - t1_f;
  console.log(`  - Warm File Lookup: ${fileWarm.toFixed(2)} ms`);

  console.log("\n=== BENCHMARK COMPLETE ===");
}

runBenchmark().then(() => process.exit(0)).catch((err) => {
  console.error("Benchmark error:", err);
  process.exit(1);
});
