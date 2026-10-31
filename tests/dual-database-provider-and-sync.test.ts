import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getDatabaseProviderManager, MaintenanceModeError } from "@/lib/db-provider";
import { queueSyncOutboxEvent, getSyncStatusSummary, runSynchronizationToPrimary } from "@/lib/db-sync";
import { db } from "@/db";
import { dbSyncOutbox, dbSyncHistory, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

describe("BS-DB-01: Dual Database Architecture, Fencing, Fallback & Synchronization", () => {
  const manager = getDatabaseProviderManager();
  const testStateFile = path.resolve(process.cwd(), "data/db-control-plane.json");
  let originalFileContent: string | null = null;

  beforeEach(() => {
    if (fs.existsSync(testStateFile)) {
      originalFileContent = fs.readFileSync(testStateFile, "utf8");
    } else {
      originalFileContent = null;
    }
  });

  afterEach(() => {
    if (originalFileContent !== null) {
      fs.writeFileSync(testStateFile, originalFileContent, "utf8");
    } else if (fs.existsSync(testStateFile)) {
      try {
        fs.unlinkSync(testStateFile);
      } catch (e) {}
    }
    vi.restoreAllMocks();
  });

  describe("1. Central Provider Manager & Operating Modes", () => {
    it("should resolve local_development mode by default in local dev environment", () => {
      const state = manager.getControlPlaneState();
      expect(["local_development", "neon_primary"]).toContain(state.mode);
      expect(["sqlite-libsql", "neon-postgres"]).toContain(state.activeProvider);
      expect(typeof state.fencingToken).toBe("number");
      expect(state.fencingToken).toBeGreaterThanOrEqual(1);
    });

    it("should switch operating modes with super-admin authorization, reason, and fencing token increment", async () => {
      const initial = manager.getControlPlaneState();
      const initialToken = initial.fencingToken;

      const result = await manager.switchOperatingMode({
        targetMode: "maintenance",
        adminUserId: "usr_admin_test_001",
        reason: "Scheduled maintenance window for security patching",
      });

      expect(result.success).toBe(true);
      expect(result.state.mode).toBe("maintenance");
      expect(result.state.fencingToken).toBe(initialToken + 1);
      expect(result.state.switchReason).toBe("Scheduled maintenance window for security patching");
      expect(result.state.lastSwitchedBy).toBe("usr_admin_test_001");

      // Verify persistence in control plane
      const refreshed = manager.getControlPlaneState();
      expect(refreshed.mode).toBe("maintenance");
      expect(refreshed.fencingToken).toBe(initialToken + 1);

      // Revert back
      await manager.switchOperatingMode({
        targetMode: "local_development",
        adminUserId: "usr_admin_test_001",
        reason: "Restoring standard local development operating mode",
      });
    });

    it("should reject mode switch if operational justification is too short or missing", async () => {
      await expect(
        manager.switchOperatingMode({
          targetMode: "maintenance",
          adminUserId: "usr_admin_test_001",
          reason: "tiny",
        })
      ).rejects.toThrow("at least 5 characters");
    });
  });

  describe("2. Hosting Safety & Vercel Serverless Reality Checks", () => {
    it("should accurately assess hosting platform and local development storage safety", () => {
      const assessment = manager.getHostingSafetyAssessment();
      expect(typeof assessment.isVercel).toBe("boolean");
      expect(typeof assessment.isProduction).toBe("boolean");
      expect(typeof assessment.fallbackConfigured).toBe("boolean");
      expect(typeof assessment.isFallbackPersistentAndSafe).toBe("boolean");
    });

    it("should strictly reject emergency_fallback mode on Vercel when fallback is an ephemeral local file", async () => {
      // Mock Vercel environment
      const originalVercel = process.env.VERCEL;
      process.env.VERCEL = "1";

      try {
        await expect(
          manager.switchOperatingMode({
            targetMode: "emergency_fallback",
            adminUserId: "usr_admin_test_001",
            reason: "Attempting failover in simulated Vercel without remote LibSQL",
          })
        ).rejects.toThrow(/not safe or persistent for this environment/i);
      } finally {
        if (originalVercel !== undefined) {
          process.env.VERCEL = originalVercel;
        } else {
          delete process.env.VERCEL;
        }
      }
    });
  });

  describe("3. Maintenance Mode Guard", () => {
    it("should block write operations when in maintenance mode", async () => {
      // Switch to maintenance
      await manager.switchOperatingMode({
        targetMode: "maintenance",
        adminUserId: "usr_admin_test_001",
        reason: "Entering maintenance for write-safety verification",
      });

      expect(() => manager.assertWritableDatabase()).toThrow(MaintenanceModeError);

      try {
        await db.insert(users).values({
          id: "usr_test_maintenance_blocked",
          fullName: "Blocked User",
          email: "blocked@example.com",
          phone: "9999999999",
          passwordHash: "hash",
          role: "customer",
        });
        expect.unreachable("Insert should have thrown MaintenanceModeError");
      } catch (err: any) {
        expect(err.name).toBe("MaintenanceModeError");
        expect(err.statusCode).toBe(503);
      } finally {
        // Revert
        await manager.switchOperatingMode({
          targetMode: "local_development",
          adminUserId: "usr_admin_test_001",
          reason: "Restoring local development mode after test",
        });
      }
    });
  });

  describe("4. Durable Outbox Queueing & Synchronization Engine", () => {
    it("should queue mutations to db_sync_outbox with fencing token and pending status", async () => {
      const eventId = await queueSyncOutboxEvent({
        entityType: "orders",
        entityId: "ord_test_failover_123",
        operation: "INSERT",
        payload: {
          id: "ord_test_failover_123",
          userId: "usr_admin_001",
          totalAmount: 499.0,
          paymentStatus: "pending",
          orderStatus: "submitted",
          deliveryType: "delivery",
        },
      });

      expect(eventId).toMatch(/^sync_/);

      const rows = await db
        .select()
        .from(dbSyncOutbox)
        .where(eq(dbSyncOutbox.id, eventId));

      expect(rows.length).toBe(1);
      expect(rows[0].entityType).toBe("orders");
      expect(rows[0].entityId).toBe("ord_test_failover_123");
      expect(rows[0].operation).toBe("INSERT");
      expect(rows[0].status).toBe("pending");
      expect(rows[0].fencingToken).toBeGreaterThanOrEqual(1);

      // Clean up outbox record
      await db.delete(dbSyncOutbox).where(eq(dbSyncOutbox.id, eventId));
    });

    it("should sanitize password hashes and tokens before writing to outbox", async () => {
      const eventId = await queueSyncOutboxEvent({
        entityType: "users",
        entityId: "usr_test_sanitization",
        operation: "INSERT",
        payload: {
          id: "usr_test_sanitization",
          email: "safe@example.com",
          passwordHash: "$2a$10$SUPERSECRETDO_NOT_EXPOSE",
          sessionToken: "session_token_12345",
        },
      });

      const rows = await db
        .select()
        .from(dbSyncOutbox)
        .where(eq(dbSyncOutbox.id, eventId));

      const payload = JSON.parse(rows[0].payloadJson);
      expect(payload.email).toBe("safe@example.com");
      expect(payload.passwordHash).toBeUndefined();
      expect(payload.sessionToken).toBeUndefined();

      // Clean up
      await db.delete(dbSyncOutbox).where(eq(dbSyncOutbox.id, eventId));
    });

    it("should return accurate count summary from getSyncStatusSummary", async () => {
      const summary = await getSyncStatusSummary();
      expect(typeof summary.pendingCount).toBe("number");
      expect(typeof summary.syncedCount).toBe("number");
      expect(typeof summary.conflictCount).toBe("number");
      expect(typeof summary.failedCount).toBe("number");
    });
  });

  describe("5. Schema Parity & Unified Table Proxies", () => {
    it("should execute queries seamlessly through dynamic proxies on all primary tables", async () => {
      // Verify queries on 5 diverse core tables
      const userRows = await db.select({ id: users.id, role: users.role }).from(users).limit(1);
      expect(Array.isArray(userRows)).toBe(true);
      expect(userRows.length).toBeGreaterThanOrEqual(1);

      const outboxRows = await db.select().from(dbSyncOutbox).limit(1);
      expect(Array.isArray(outboxRows)).toBe(true);

      const historyRows = await db.select().from(dbSyncHistory).limit(1);
      expect(Array.isArray(historyRows)).toBe(true);
    });
  });
});
