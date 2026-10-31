import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/db";
import { dbSyncOutbox, orders, orderItems, payments, paymentSubmissions } from "@/db/schema";
import {
  queueSyncOutboxEvent,
  recordMutationIfInFallback,
  getSyncStatusSummary,
  retryFailedOutboxEvents,
  runSynchronizationToPrimary,
  isSynchronizationLocked,
  TABLE_FIELD_ALLOWLIST,
  ENTITY_REPLAY_PRIORITY,
} from "@/lib/db-sync";
import { getDatabaseProviderManager } from "@/lib/db-provider";
import { eq } from "drizzle-orm";
import crypto from "crypto";

describe("BS-FINAL-06: Outbox Atomicity, Dependency Replay, Conflict Rules & Recovery", () => {
  const manager = getDatabaseProviderManager();
  const createdEventIds: string[] = [];

  afterEach(async () => {
    for (const id of createdEventIds) {
      await db.delete(dbSyncOutbox).where(eq(dbSyncOutbox.id, id)).catch(() => {});
    }
    createdEventIds.length = 0;
  });

  describe("1. Strict Allowlist & Security Validation", () => {
    it("should allow approved entities in TABLE_FIELD_ALLOWLIST", () => {
      expect(TABLE_FIELD_ALLOWLIST).toHaveProperty("users");
      expect(TABLE_FIELD_ALLOWLIST).toHaveProperty("orders");
      expect(TABLE_FIELD_ALLOWLIST).toHaveProperty("order_items");
      expect(TABLE_FIELD_ALLOWLIST).toHaveProperty("order_files");
      expect(TABLE_FIELD_ALLOWLIST).toHaveProperty("order_status_history");
      expect(TABLE_FIELD_ALLOWLIST).toHaveProperty("payments");
      expect(TABLE_FIELD_ALLOWLIST).toHaveProperty("payment_submissions");
      expect(TABLE_FIELD_ALLOWLIST).toHaveProperty("order_returns");
      expect(TABLE_FIELD_ALLOWLIST).toHaveProperty("order_return_items");
      expect(TABLE_FIELD_ALLOWLIST).toHaveProperty("products");
      expect(TABLE_FIELD_ALLOWLIST).toHaveProperty("product_categories");
      expect(TABLE_FIELD_ALLOWLIST).toHaveProperty("product_reviews");
      expect(TABLE_FIELD_ALLOWLIST).toHaveProperty("shop_settings");
      expect(TABLE_FIELD_ALLOWLIST).toHaveProperty("shop_upi_accounts");
      expect(TABLE_FIELD_ALLOWLIST).toHaveProperty("account_appeals");
    });

    it("should reject arbitrary unauthorized entities from outbox queueing", async () => {
      await expect(
        queueSyncOutboxEvent({
          entityType: "unauthorized_secret_table",
          entityId: "sec_123",
          operation: "INSERT",
          payload: { foo: "bar" },
        })
      ).rejects.toThrow(/not in the synchronizable allowlist/);
    });

    it("should sanitize and strip passwordHash and sessionToken from outbox payload", async () => {
      const eventId = await queueSyncOutboxEvent({
        entityType: "users",
        entityId: `usr_${crypto.randomUUID()}`,
        operation: "INSERT",
        payload: {
          id: `usr_${crypto.randomUUID()}`,
          name: "Test Customer",
          email: "customer@test.com",
          passwordHash: "$2a$12$SuperSecretHashedPasswordNeverSyncThis",
          sessionToken: "transient_secret_session_token_12345",
        },
      });

      createdEventIds.push(eventId);

      const rows = await db.select().from(dbSyncOutbox).where(eq(dbSyncOutbox.id, eventId));
      expect(rows.length).toBe(1);

      const savedPayload = JSON.parse(rows[0].payloadJson);
      expect(savedPayload).not.toHaveProperty("passwordHash");
      expect(savedPayload).not.toHaveProperty("sessionToken");
      expect(savedPayload.name).toBe("Test Customer");
    });
  });

  describe("2. Foreign-Key Dependency Ordering", () => {
    it("should prioritize parents before children for INSERT replay", () => {
      expect(ENTITY_REPLAY_PRIORITY["users"]).toBeLessThan(ENTITY_REPLAY_PRIORITY["orders"]);
      expect(ENTITY_REPLAY_PRIORITY["orders"]).toBeLessThan(ENTITY_REPLAY_PRIORITY["order_items"]);
      expect(ENTITY_REPLAY_PRIORITY["orders"]).toBeLessThan(ENTITY_REPLAY_PRIORITY["payments"]);
      expect(ENTITY_REPLAY_PRIORITY["order_returns"]).toBeLessThan(ENTITY_REPLAY_PRIORITY["order_return_items"]);
    });

    it("should return sorted preview in dependency order during dry-run", async () => {
      // Create out-of-order pending events
      const childEventId = await queueSyncOutboxEvent({
        entityType: "order_items",
        entityId: "item_001",
        operation: "INSERT",
        payload: { id: "item_001", orderId: "ord_001", itemType: "product", quantity: 1 },
      });
      const parentEventId = await queueSyncOutboxEvent({
        entityType: "orders",
        entityId: "ord_001",
        operation: "INSERT",
        payload: { id: "ord_001", orderReference: "ORD-001", totalAmount: 500 },
      });
      const userEventId = await queueSyncOutboxEvent({
        entityType: "users",
        entityId: "usr_001",
        operation: "INSERT",
        payload: { id: "usr_001", name: "User 1", email: "u1@test.com" },
      });

      createdEventIds.push(childEventId, parentEventId, userEventId);

      const summary = await runSynchronizationToPrimary({
        adminUserId: "usr_admin_test",
        dryRun: true,
      });

      const preview = summary.details.preview || [];
      const userIdx = preview.findIndex((e) => e.entityType === "users");
      const orderIdx = preview.findIndex((e) => e.entityType === "orders");
      const itemIdx = preview.findIndex((e) => e.entityType === "order_items");

      // Verify users comes before orders, and orders comes before order_items
      expect(userIdx).toBeLessThan(orderIdx);
      expect(orderIdx).toBeLessThan(itemIdx);
    });
  });

  describe("3. Mode B Fallback Transactional Recording", () => {
    it("should return null and no-op when recordMutationIfInFallback is called in non-fallback mode", async () => {
      // In local_development or neon_primary mode, recordMutationIfInFallback does not record outbox
      const result = await recordMutationIfInFallback(db, {
        entityType: "orders",
        entityId: "ord_test_noop",
        operation: "INSERT",
        payload: { id: "ord_test_noop" },
      });
      expect(result).toBeNull();
    });

    it("should record outbox event when operating in emergency_fallback mode", async () => {
      // Temporarily simulate Mode B state
      const origState = manager.getControlPlaneState();
      manager.saveControlPlaneState({ mode: "emergency_fallback" });

      try {
        const eventId = await recordMutationIfInFallback(db, {
          entityType: "orders",
          entityId: "ord_fallback_001",
          operation: "INSERT",
          payload: { id: "ord_fallback_001", orderReference: "ORD-FB-01", totalAmount: 350 },
        });

        expect(eventId).not.toBeNull();
        if (eventId) createdEventIds.push(eventId);

        const rows = await db.select().from(dbSyncOutbox).where(eq(dbSyncOutbox.id, eventId!));
        expect(rows.length).toBe(1);
        expect(rows[0].entityType).toBe("orders");
        expect(rows[0].status).toBe("pending");
      } finally {
        manager.saveControlPlaneState({ mode: origState.mode });
      }
    });
  });

  describe("4. Status Summary, Oldest Pending Age & Retry", () => {
    it("should calculate summary counts, oldest pending event age, and report lock status", async () => {
      const eventId = await queueSyncOutboxEvent({
        entityType: "product_categories",
        entityId: "cat_001",
        operation: "INSERT",
        payload: { id: "cat_001", name: "Photo Frames" },
      });
      createdEventIds.push(eventId);

      const summary = await getSyncStatusSummary();
      expect(summary.pendingCount).toBeGreaterThanOrEqual(1);
      expect(summary.isSyncLocked).toBe(false);
      expect(typeof summary.oldestPendingAgeMs).toBe("number");
    });

    it("should reset failed outbox events back to pending for retry", async () => {
      const failedEventId = await queueSyncOutboxEvent({
        entityType: "products",
        entityId: "prod_fail_01",
        operation: "INSERT",
        payload: { id: "prod_fail_01", name: "Failed Prod" },
      });
      createdEventIds.push(failedEventId);

      // Mark as failed
      await db
        .update(dbSyncOutbox)
        .set({ status: "failed", errorMessage: "Transient connection drop" })
        .where(eq(dbSyncOutbox.id, failedEventId));

      const beforeRetry = await getSyncStatusSummary();
      expect(beforeRetry.failedCount).toBeGreaterThanOrEqual(1);

      // Retry
      const retryResult = await retryFailedOutboxEvents();
      expect(retryResult.resetCount).toBeGreaterThanOrEqual(1);

      const afterRetry = await getSyncStatusSummary();
      const rows = await db.select().from(dbSyncOutbox).where(eq(dbSyncOutbox.id, failedEventId));
      expect(rows[0].status).toBe("pending");
      expect(rows[0].errorMessage).toBeNull();
    });
  });
});
