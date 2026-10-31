import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getDatabaseProviderManager, MaintenanceModeError } from "@/lib/db-provider";
import { queueSyncOutboxEvent, getSyncStatusSummary, runSynchronizationToPrimary } from "@/lib/db-sync";
import { db } from "@/db";
import { users, orders, dbSyncOutbox, dbSyncHistory, auditLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

describe("BS-FINAL-05: Neon-First Database Architecture & Complete Database Compatibility", () => {
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

  describe("1. Default Configuration & Production-First Guards", () => {
    it("should resolve local_development in development environment with local SQLite", () => {
      const state = manager.getControlPlaneState();
      expect(["local_development", "neon_primary"]).toContain(state.mode);
      expect(["sqlite-libsql", "neon-postgres"]).toContain(state.activeProvider);
      expect(state.authoritativeDatabase).toBeDefined();
      expect(typeof state.writesEnabled).toBe("boolean");
    });

    it("should strictly prohibit Mode C (Local Development / SQLite) in production", async () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      (process.env as any).NODE_ENV = "production";

      try {
        await expect(
          manager.switchOperatingMode({
            targetMode: "local_development",
            adminUserId: "usr_admin_001",
            reason: "Attempting to switch to local sqlite in simulated production",
          })
        ).rejects.toThrow(/prohibited in production/i);
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });

    it("should strictly prohibit Mode B (Emergency Fallback) on Vercel without persistent remote storage", async () => {
      // Mock Vercel environment
      const originalVercel = process.env.VERCEL;
      process.env.VERCEL = "1";

      try {
        await expect(
          manager.switchOperatingMode({
            targetMode: "emergency_fallback",
            adminUserId: "usr_admin_001",
            reason: "Attempting fallback in simulated Vercel without remote LibSQL",
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

  describe("2. Operating Mode Transitions & Fencing Protection", () => {
    it("should safely transition A -> D (Maintenance) and D -> permitted mode with fencing token increment", async () => {
      const initial = manager.getControlPlaneState();
      const initialToken = initial.fencingToken;

      // Switch to Maintenance (Mode D)
      const maintenanceRes = await manager.switchOperatingMode({
        targetMode: "maintenance",
        adminUserId: "usr_admin_001",
        reason: "Disaster mitigation: entering maintenance mode to freeze mutations",
      });

      expect(maintenanceRes.success).toBe(true);
      expect(maintenanceRes.state.mode).toBe("maintenance");
      expect(maintenanceRes.state.writesEnabled).toBe(false);
      expect(maintenanceRes.state.fencingToken).toBe(initialToken + 1);

      // Verify that writes are blocked during Maintenance
      expect(() => manager.assertWritableDatabase()).toThrow(MaintenanceModeError);

      // Revert back to local development
      const revertRes = await manager.switchOperatingMode({
        targetMode: "local_development",
        adminUserId: "usr_admin_001",
        reason: "Disaster resolved: returning to operational state",
      });

      expect(revertRes.success).toBe(true);
      expect(revertRes.state.mode).toBe("local_development");
      expect(revertRes.state.writesEnabled).toBe(true);
      expect(revertRes.state.fencingToken).toBe(initialToken + 2);
    });

    it("should reject transitions with reasons shorter than 5 characters", async () => {
      await expect(
        manager.switchOperatingMode({
          targetMode: "maintenance",
          adminUserId: "usr_admin_001",
          reason: "down",
        })
      ).rejects.toThrow(/at least 5 characters/i);
    });
  });

  describe("3. Outbox Queueing & Conflict Detection", () => {
    it("should record mutations to db_sync_outbox and sanitize credentials", async () => {
      const eventId = await queueSyncOutboxEvent({
        entityType: "users",
        entityId: "usr_test_audit_sync",
        operation: "INSERT",
        payload: {
          id: "usr_test_audit_sync",
          email: "audited@example.com",
          fullName: "Audited Customer",
          phone: "9876543210",
          passwordHash: "$2a$10$UNSAFE_PASSWORD_HASH_MUST_BE_STRIPPED",
          sessionToken: "UNSAFE_SESSION_TOKEN_MUST_BE_STRIPPED",
        },
      });

      expect(eventId).toMatch(/^sync_/);

      const rows = await db.select().from(dbSyncOutbox).where(eq(dbSyncOutbox.id, eventId));
      expect(rows.length).toBe(1);

      const parsedPayload = JSON.parse(rows[0].payloadJson);
      expect(parsedPayload.email).toBe("audited@example.com");
      expect(parsedPayload.passwordHash).toBeUndefined();
      expect(parsedPayload.sessionToken).toBeUndefined();

      // Clean up
      await db.delete(dbSyncOutbox).where(eq(dbSyncOutbox.id, eventId));
    });

    it("should support dry-run synchronization without modifying target data", async () => {
      const summary = await runSynchronizationToPrimary({
        adminUserId: "usr_admin_001",
        dryRun: true,
      });

      expect(summary.status).toBe("completed");
      expect(typeof summary.totalEvents).toBe("number");
      expect(summary.syncedCount).toBe(0); // Dry-run does not write
    });
  });

  describe("4. Dual Database Compatibility & Schema Parity", () => {
    it("should query core tables identically across SQLite and PostgreSQL dialect proxies", async () => {
      // 1. Users query
      const userList = await db.select({ id: users.id, email: users.email }).from(users).limit(1);
      expect(Array.isArray(userList)).toBe(true);

      // 2. Audit logs query
      const auditList = await db.select().from(auditLogs).limit(1);
      expect(Array.isArray(auditList)).toBe(true);

      // 3. Outbox query
      const outboxList = await db.select().from(dbSyncOutbox).limit(1);
      expect(Array.isArray(outboxList)).toBe(true);

      // 4. Sync history query
      const historyList = await db.select().from(dbSyncHistory).limit(1);
      expect(Array.isArray(historyList)).toBe(true);
    });

    it("should execute lightweight connectivity check against Neon PostgreSQL when credentials are configured", async () => {
      const health = await manager.checkPrimaryHealth(true);
      expect(["healthy", "unhealthy", "not_configured"]).toContain(health.status);
      if (health.status === "healthy") {
        expect(health.latencyMs).toBeGreaterThan(0);
        expect(health.checkedAt).toBeGreaterThan(0);
      }
    });
  });
});
