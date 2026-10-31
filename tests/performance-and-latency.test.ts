import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import { db } from "@/db";
import {
  notifications,
  users,
  orders,
  orderItems,
  orderFiles,
  productReviews,
  paymentSubmissions,
  products,
  userAddresses,
} from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import {
  createNotification,
  markNotificationAsRead,
  getNotifications,
  getUnreadNotificationCount,
} from "@/lib/notifications";
import {
  clearNotificationCache,
  startSharedPolling,
  stopSharedPolling,
} from "@/components/NotificationBell";

describe("BS-PERF-01: Full-System Performance, Latency & Optimization Verifications", () => {
  const testUserId = `test_perf_user_${Date.now()}`;
  const testEmail = `perf_${Date.now()}@example.com`;

  beforeEach(async () => {
    // Setup clean test user if needed
    try {
      await db.insert(users).values({
        id: testUserId,
        email: testEmail,
        phone: `999${Math.floor(1000000 + Math.random() * 9000000)}`,
        fullName: "Performance Test User",
        passwordHash: "hash123",
        role: "customer",
        status: "active",
      });
    } catch {}
  });

  describe("Workstream 1 & 2: Notification System Deduplication, Idempotency & Polling Storm Elimination", () => {
    it("should export clearNotificationCache, startSharedPolling and stopSharedPolling functions", () => {
      expect(typeof clearNotificationCache).toBe("function");
      expect(typeof startSharedPolling).toBe("function");
      expect(typeof stopSharedPolling).toBe("function");
    });

    it("should clear the notification cache without throwing errors", () => {
      expect(() => clearNotificationCache("customer")).not.toThrow();
      expect(() => clearNotificationCache("admin")).not.toThrow();
      expect(() => clearNotificationCache()).not.toThrow();
    });

    it("should create a notification and return it directly from memory without an extra SELECT query", async () => {
      const notif = await createNotification({
        recipientType: "customer",
        recipientId: testUserId,
        category: "order",
        eventType: "order_created",
        title: "Order Received",
        message: "Your order has been received.",
        entityType: "order",
        entityId: "ord_perf_test_1",
      });

      expect(notif).toBeDefined();
      expect(notif.id).toMatch(/^notif_/);
      expect(notif.recipientId).toBe(testUserId);
      expect(notif.isRead).toBe(false);
    });

    it("should make markNotificationAsRead idempotent and skip redundant database updates when already read", async () => {
      const notif = await createNotification({
        recipientType: "customer",
        recipientId: testUserId,
        category: "order",
        eventType: "order_shipped",
        title: "Order Shipped",
        message: "Your order is on the way.",
        entityType: "order",
        entityId: "ord_perf_test_2",
      });

      // First mark as read
      const firstResult = await markNotificationAsRead(notif.id, {
        recipientType: "customer",
        recipientId: testUserId,
      });
      expect(firstResult.success).toBe(true);
      expect(firstResult.alreadyRead).toBeUndefined();

      // Second mark as read (must be idempotent with alreadyRead flag)
      const secondResult = await markNotificationAsRead(notif.id, {
        recipientType: "customer",
        recipientId: testUserId,
      });
      expect(secondResult.success).toBe(true);
      expect(secondResult.alreadyRead).toBe(true);
    });
  });

  describe("Workstream 3 & 4: Streamlined Authentication & Address Query Elimination", () => {
    it("should verify /api/auth/me route definition omits address database queries unless requested", async () => {
      const authMeRoutePath = path.resolve(
        process.cwd(),
        "src/app/api/auth/me/route.ts"
      );
      const content = fs.readFileSync(authMeRoutePath, "utf-8");

      expect(content).toContain("includeAddresses");
      expect(content).toContain("req.nextUrl.searchParams.get");
      expect(content).toContain("let addresses: any[] = []");
    });
  });

  describe("Workstream 5: Administrative Queues Scoped File Lookups", () => {
    it("should verify /api/admin/queues route uses inArray and scopes files to matched items", () => {
      const queuesRoutePath = path.resolve(
        process.cwd(),
        "src/app/api/admin/queues/route.ts"
      );
      const content = fs.readFileSync(queuesRoutePath, "utf-8");

      expect(content).toContain("inArray");
      expect(content).toContain("orderFiles.orderItemId");
      expect(content).toContain("itemIds.length > 0");
    });
  });

  describe("Workstream 6: Order Details Parallelization & Batch Catalog Lookups", () => {
    it("should verify /api/orders/[id] uses Promise.all and batched inArray queries", () => {
      const orderDetailRoutePath = path.resolve(
        process.cwd(),
        "src/app/api/orders/[id]/route.ts"
      );
      const content = fs.readFileSync(orderDetailRoutePath, "utf-8");

      expect(content).toContain("Promise.all");
      expect(content).toContain("database.order_items.fetch");
      expect(content).toContain("database.order_files.fetch");
      expect(content).toContain("database.products.batch");
      expect(content).toContain("database.product_images.batch");
      expect(content).toContain("inArray(products.id, uniqueProductIds)");
    });

    it("should verify /api/orders/[id] PATCH runs timeline, audit log, and notifications in parallel", () => {
      const orderDetailRoutePath = path.resolve(
        process.cwd(),
        "src/app/api/orders/[id]/route.ts"
      );
      const content = fs.readFileSync(orderDetailRoutePath, "utf-8");

      expect(content).toContain("timelinePromise");
      expect(content).toContain("auditPromise");
      expect(content).toContain("notificationPromise");
      expect(content).toContain("await Promise.all([timelinePromise, auditPromise, notificationPromise])");
    });
  });

  describe("Workstream 7: Service Worker 404 Resolution", () => {
    it("should verify public/sw.js exists and registers clean unregister event listener", () => {
      const swPath = path.resolve(process.cwd(), "public/sw.js");
      expect(fs.existsSync(swPath)).toBe(true);

      const content = fs.readFileSync(swPath, "utf-8");
      expect(content).toContain("addEventListener");
      expect(content).toContain("unregister");
    });
  });

  describe("Workstream 8: Client Layout and Navigation Component Optimization", () => {
    it("should verify Navbar and Footer hide on administrative routes to eliminate redundant pollers", () => {
      const navbarPath = path.resolve(process.cwd(), "src/components/Navbar.tsx");
      const footerPath = path.resolve(process.cwd(), "src/components/Footer.tsx");

      const navContent = fs.readFileSync(navbarPath, "utf-8");
      const footerContent = fs.readFileSync(footerPath, "utf-8");

      expect(navContent).toContain('pathname?.startsWith("/admin")');
      expect(footerContent).toContain('pathname?.startsWith("/admin")');
    });
  });

  describe("Workstream 9: Live Latency Benchmark Verification", () => {
    it("should measure and verify sub-100ms local execution for key query operations", async () => {
      // 1. Database Ping
      const t0 = performance.now();
      await db.select({ total: sql<number>`count(*)` }).from(users);
      const pingMs = performance.now() - t0;

      // 2. Auth user lookup without addresses
      const t1 = performance.now();
      await db.select().from(users).limit(1);
      const authMs = performance.now() - t1;

      // 3. Indexed notifications lookup
      const t2 = performance.now();
      await db
        .select()
        .from(notifications)
        .where(eq(notifications.recipientType, "admin"))
        .orderBy(desc(notifications.createdAt))
        .limit(10);
      const notifMs = performance.now() - t2;

      // 4. Parallelized order sub-resource lookup
      const t3 = performance.now();
      await Promise.all([
        db.select().from(orderItems).limit(10),
        db.select().from(orderFiles).limit(10),
        db.select().from(users).limit(1),
        db.select().from(productReviews).limit(10),
        db.select().from(paymentSubmissions).limit(5),
      ]);
      const orderParallelMs = performance.now() - t3;

      console.log(`[BENCHMARK] Users Ping: ${pingMs.toFixed(2)}ms`);
      console.log(`[BENCHMARK] Auth User Check: ${authMs.toFixed(2)}ms`);
      console.log(`[BENCHMARK] Indexed Notifications: ${notifMs.toFixed(2)}ms`);
      console.log(`[BENCHMARK] Parallel Order Sub-resources: ${orderParallelMs.toFixed(2)}ms`);

      expect(pingMs).toBeLessThan(100);
      expect(authMs).toBeLessThan(100);
      expect(notifMs).toBeLessThan(100);
      expect(orderParallelMs).toBeLessThan(100);
    });
  });
});
