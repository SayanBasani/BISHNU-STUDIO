/**
 * Bishnu Studio - Database Synchronization & Outbox Engine
 *
 * Implements BS-DB-01 and BS-FINAL-06 Recovery & Synchronization:
 * - Transactional outbox logging for mutations occurring during fallback mode (Mode B)
 * - Explicit allowlist of synchronizable tables and fields
 * - Foreign-key dependency ordering for deterministic replay
 * - Non-blind domain-aware conflict detection (orders, payments, refunds, inventory)
 * - Target database idempotency protection
 * - Synchronization concurrency lock preventing duplicate replay
 * - Enhanced status summary with oldest pending age and previews
 * - Manual retry for failed events
 */

import { db } from "@/db";
import { dbSyncOutbox, dbSyncHistory } from "@/db/schema";
import { getDatabaseProviderManager } from "./db-provider";
import { eq, asc, desc, sql } from "drizzle-orm";
import crypto from "crypto";

// Ensure Next environment variables are loaded in CLI/test contexts
if (!process.env.NEON_DATABASE_URL && typeof window === "undefined") {
  try {
    const { loadEnvConfig } = require("@next/env");
    loadEnvConfig(process.cwd());
  } catch (e) {
    // Ignore if @next/env unavailable
  }
}

export interface SyncOutboxPayload {
  entityType: string;
  entityId: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  payload: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface SyncSummary {
  historyId: string;
  fencingToken: number;
  totalEvents: number;
  syncedCount: number;
  conflictsCount: number;
  failuresCount: number;
  status: "completed" | "partial" | "failed";
  details: {
    conflicts: Array<{ eventId: string; entityType: string; entityId: string; reason: string }>;
    failures: Array<{ eventId: string; entityType: string; entityId: string; error: string }>;
    preview?: Array<{ eventId: string; entityType: string; entityId: string; operation: string }>;
  };
}

/**
 * Strict table and column allowlist for database synchronization.
 * Prevents arbitrary SQL injection and protects sensitive columns (e.g., passwords, sessions).
 */
export const TABLE_FIELD_ALLOWLIST: Record<string, string[]> = {
  users: ["id", "name", "email", "phone", "role", "avatarUrl", "isActive", "createdAt", "updatedAt"],
  user_addresses: ["id", "userId", "recipientName", "phone", "addressLine1", "addressLine2", "city", "state", "pincode", "isDefault", "createdAt", "updatedAt"],
  product_categories: ["id", "name", "slug", "description", "sortOrder", "isActive", "createdAt"],
  products: ["id", "name", "slug", "description", "price", "discountedPrice", "stockQuantity", "isAvailable", "sku", "categoryId", "createdAt", "updatedAt"],
  product_images: ["id", "productId", "imageUrl", "altText", "isPrimary", "sortOrder"],
  orders: ["id", "orderReference", "customerId", "orderType", "subtotal", "discount", "additionalCharges", "totalAmount", "paymentStatus", "paymentMethod", "orderStatus", "deliveryType", "orderNotes", "shippingAddressJson", "createdAt", "updatedAt"],
  order_items: ["id", "orderId", "itemType", "productId", "serviceId", "configurationJson", "quantity", "pageCount", "unitPriceSnapshot", "totalPriceSnapshot", "specialInstructions", "stockDeducted", "createdAt"],
  order_files: ["id", "orderId", "orderItemId", "uploadedByUserId", "originalFilename", "storedFilename", "storageKey", "fileSize", "mimeType", "fileCategory", "pageCount", "retentionExpiresAt", "isDeleted", "createdAt"],
  payments: ["id", "orderId", "paymentProvider", "transactionReference", "amount", "currency", "status", "receivingAccountId", "metadataJson", "createdAt"],
  payment_submissions: ["id", "orderId", "customerId", "amount", "receivingAccountId", "receivingUpiIdSnapshot", "receivingAccountNameSnapshot", "upiIdUsed", "transactionId", "screenshotFileId", "screenshotUrl", "status", "submissionType", "isDuplicateFlagged", "rejectionReason", "rejectionNote", "verifiedByAdminId", "verifiedAt", "verificationNote", "createdAt", "updatedAt"],
  order_returns: ["id", "orderId", "customerId", "actionType", "resolutionType", "reasonCategory", "customerNote", "status", "physicalStatus", "refundStatus", "refundMethod", "refundAmount", "refundReference", "refundProofUrl", "payoutCompletedAt", "settledByAdminId", "adminNote", "customerDisputeNote", "customerDisputedAt", "createdAt", "updatedAt"],
  order_return_items: ["id", "returnId", "orderItemId", "quantity", "conditionReceived", "inspectionNotes"],
  service_prices: ["id", "serviceType", "subType", "price", "currency", "unit", "isActive", "updatedAt"],
  notifications: ["id", "userId", "title", "message", "type", "linkUrl", "isRead", "metadataJson", "createdAt"],
  audit_logs: ["id", "userId", "action", "entityType", "entityId", "detailsJson", "ipAddress", "createdAt"],
};

/**
 * Foreign-key dependency priority. Lower numbers are inserted first and deleted last.
 */
export const ENTITY_REPLAY_PRIORITY: Record<string, number> = {
  users: 10,
  user_addresses: 20,
  product_categories: 30,
  products: 40,
  product_images: 45,
  orders: 50,
  order_items: 60,
  order_files: 70,
  payments: 80,
  payment_submissions: 90,
  order_returns: 100,
  order_return_items: 110,
  service_prices: 120,
  notifications: 130,
  audit_logs: 140,
};

// Concurrency lock for synchronization replay
let isSyncRunning = false;
let syncLockAcquiredAt = 0;
const SYNC_LOCK_TIMEOUT_MS = 60000; // 60 seconds auto-expiration

export function isSynchronizationLocked(): boolean {
  if (!isSyncRunning) return false;
  if (Date.now() - syncLockAcquiredAt > SYNC_LOCK_TIMEOUT_MS) {
    isSyncRunning = false;
    return false;
  }
  return true;
}

/**
 * Record a mutation to the durable outbox log.
 * Validates entity allowlist and strips transient secrets.
 */
export async function queueSyncOutboxEvent(params: SyncOutboxPayload, customDb?: any): Promise<string> {
  const manager = getDatabaseProviderManager();
  const state = manager.getControlPlaneState();
  const targetDb = customDb || db;

  const entityKey = params.entityType.toLowerCase();
  const allowedFields = TABLE_FIELD_ALLOWLIST[entityKey];
  if (!allowedFields) {
    throw new Error(`Outbox validation error: Entity type '${params.entityType}' is not in the synchronizable allowlist.`);
  }

  // Filter payload to only allowed fields and strip sensitive columns
  const cleanPayload: Record<string, any> = {};
  for (const field of allowedFields) {
    if (params.payload[field] !== undefined) {
      cleanPayload[field] = params.payload[field];
    }
  }

  delete cleanPayload.passwordHash;
  delete cleanPayload.sessionToken;
  delete cleanPayload.tokenHash;

  const eventId = `sync_${crypto.randomUUID()}`;

  await targetDb.insert(dbSyncOutbox).values({
    id: eventId,
    entityType: entityKey,
    entityId: params.entityId,
    operation: params.operation,
    payloadJson: JSON.stringify(cleanPayload),
    fencingToken: state.fencingToken,
    status: "pending",
    retryCount: 0,
    createdAt: Date.now(),
  });

  return eventId;
}

/**
 * Transactional helper: Records an outbox event only when the active operating mode is emergency_fallback (Mode B).
 * Safe to call with either the global db client or a transaction client `tx`.
 */
export async function recordMutationIfInFallback(
  txOrDb: any,
  params: SyncOutboxPayload
): Promise<string | null> {
  const manager = getDatabaseProviderManager();
  const state = manager.getControlPlaneState();
  if (state.mode !== "emergency_fallback") {
    return null;
  }
  return await queueSyncOutboxEvent(params, txOrDb);
}

/**
 * Get comprehensive summary of outbox events, including age of oldest pending event and conflict details.
 */
export async function getSyncStatusSummary(): Promise<{
  pendingCount: number;
  syncedCount: number;
  conflictCount: number;
  failedCount: number;
  oldestPendingAgeMs: number | null;
  lastFailedError: string | null;
  isSyncLocked: boolean;
  lastHistory: any | null;
  recentConflicts: Array<{ id: string; entityType: string; entityId: string; conflictDetails?: string }>;
}> {
  try {
    const outboxRows = await db
      .select({
        status: dbSyncOutbox.status,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(dbSyncOutbox)
      .groupBy(dbSyncOutbox.status);

    let pendingCount = 0;
    let syncedCount = 0;
    let conflictCount = 0;
    let failedCount = 0;

    for (const r of outboxRows) {
      const c = Number(r.count) || 0;
      if (r.status === "pending") pendingCount = c;
      else if (r.status === "synced") syncedCount = c;
      else if (r.status === "conflict") conflictCount = c;
      else if (r.status === "failed") failedCount = c;
    }

    // Get oldest pending event timestamp
    let oldestPendingAgeMs: number | null = null;
    if (pendingCount > 0) {
      const oldestPending = await db
        .select({ createdAt: dbSyncOutbox.createdAt })
        .from(dbSyncOutbox)
        .where(eq(dbSyncOutbox.status, "pending"))
        .orderBy(asc(dbSyncOutbox.createdAt))
        .limit(1);

      if (oldestPending.length > 0 && oldestPending[0].createdAt) {
        oldestPendingAgeMs = Math.max(0, Date.now() - Number(oldestPending[0].createdAt));
      }
    }

    // Get latest failed error
    let lastFailedError: string | null = null;
    if (failedCount > 0) {
      const latestFailed = await db
        .select({ errorMessage: dbSyncOutbox.errorMessage })
        .from(dbSyncOutbox)
        .where(eq(dbSyncOutbox.status, "failed"))
        .orderBy(desc(dbSyncOutbox.createdAt))
        .limit(1);

      if (latestFailed.length > 0) {
        lastFailedError = latestFailed[0].errorMessage || "Unknown error";
      }
    }

    // Recent conflicts
    let recentConflicts: any[] = [];
    if (conflictCount > 0) {
      recentConflicts = await db
        .select({
          id: dbSyncOutbox.id,
          entityType: dbSyncOutbox.entityType,
          entityId: dbSyncOutbox.entityId,
          conflictDetails: dbSyncOutbox.conflictDetails,
        })
        .from(dbSyncOutbox)
        .where(eq(dbSyncOutbox.status, "conflict"))
        .limit(10);
    }

    const lastHistory = await db
      .select()
      .from(dbSyncHistory)
      .orderBy(desc(dbSyncHistory.startedAt))
      .limit(1);

    return {
      pendingCount,
      syncedCount,
      conflictCount,
      failedCount,
      oldestPendingAgeMs,
      lastFailedError,
      isSyncLocked: isSynchronizationLocked(),
      lastHistory: lastHistory[0] || null,
      recentConflicts,
    };
  } catch (err: any) {
    return {
      pendingCount: 0,
      syncedCount: 0,
      conflictCount: 0,
      failedCount: 0,
      oldestPendingAgeMs: null,
      lastFailedError: null,
      isSyncLocked: false,
      lastHistory: null,
      recentConflicts: [],
    };
  }
}

/**
 * Resets failed outbox events back to "pending" so they can be retried.
 */
export async function retryFailedOutboxEvents(): Promise<{ resetCount: number }> {
  const result = await db
    .update(dbSyncOutbox)
    .set({
      status: "pending",
      errorMessage: null,
    })
    .where(eq(dbSyncOutbox.status, "failed"));

  return { resetCount: (result as any)?.rowsAffected ?? 0 };
}

/**
 * Run safe recovery and synchronization from SQLite/LibSQL Fallback to Neon PostgreSQL Primary.
 */
export async function runSynchronizationToPrimary(params: {
  adminUserId: string;
  dryRun?: boolean;
}): Promise<SyncSummary> {
  const { adminUserId, dryRun = false } = params;

  if (!dryRun && isSynchronizationLocked()) {
    throw new Error("Synchronization is currently in progress. Please wait for the running batch to complete.");
  }

  const manager = getDatabaseProviderManager();
  const state = manager.getControlPlaneState();

  // 1. Fetch pending outbox events
  const pendingEvents = await db
    .select()
    .from(dbSyncOutbox)
    .where(eq(dbSyncOutbox.status, "pending"))
    .orderBy(asc(dbSyncOutbox.createdAt));

  const historyId = `synchist_${crypto.randomUUID()}`;
  const now = Date.now();

  // Sort events by foreign-key dependency order
  const sortedEvents = [...pendingEvents].sort((a, b) => {
    const priorityA = ENTITY_REPLAY_PRIORITY[a.entityType.toLowerCase()] ?? 999;
    const priorityB = ENTITY_REPLAY_PRIORITY[b.entityType.toLowerCase()] ?? 999;

    // Deletions happen in reverse priority (children before parents)
    if (a.operation === "DELETE" && b.operation === "DELETE") {
      return priorityB - priorityA;
    }
    // Inserts happen in forward priority (parents before children)
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return Number(a.createdAt) - Number(b.createdAt);
  });

  // If dry run, inspect and report preview without executing writes
  if (dryRun) {
    const preview = sortedEvents.map((e) => ({
      eventId: e.id,
      entityType: e.entityType,
      entityId: e.entityId,
      operation: e.operation,
    }));

    return {
      historyId,
      fencingToken: state.fencingToken,
      totalEvents: sortedEvents.length,
      syncedCount: 0,
      conflictsCount: 0,
      failuresCount: 0,
      status: "completed",
      details: {
        conflicts: [],
        failures: [],
        preview,
      },
    };
  }

  // Acquire synchronization lock for live execution
  isSyncRunning = true;
  syncLockAcquiredAt = Date.now();

  try {
    // 2. Pre-flight health check on Neon Primary
    const primaryHealth = await manager.checkPrimaryHealth(true);
    if (primaryHealth.status !== "healthy") {
      throw new Error(
        `SYNCHRONIZATION ABORTED: Target Neon PostgreSQL is unreachable: ${primaryHealth.error || "Connection timed out"}`
      );
    }

    // 3. Record synchronization attempt in db_sync_history
    await db.insert(dbSyncHistory).values({
      id: historyId,
      fencingToken: state.fencingToken,
      sourceProvider: "sqlite-libsql",
      targetProvider: "neon-postgres",
      eventsCount: sortedEvents.length,
      syncedCount: 0,
      conflictsCount: 0,
      failuresCount: 0,
      status: "in_progress",
      executedByUserId: adminUserId,
      startedAt: now,
    });

    const conflicts: Array<{ eventId: string; entityType: string; entityId: string; reason: string }> = [];
    const failures: Array<{ eventId: string; entityType: string; entityId: string; error: string }> = [];
    let syncedCount = 0;

    if (sortedEvents.length === 0) {
      await db
        .update(dbSyncHistory)
        .set({
          status: "completed",
          completedAt: Date.now(),
          detailsJson: JSON.stringify({ message: "No pending synchronization events." }),
        })
        .where(eq(dbSyncHistory.id, historyId));

      manager.saveControlPlaneState({
        lastSyncAt: Date.now(),
        lastSyncStatus: "completed",
      });

      return {
        historyId,
        fencingToken: state.fencingToken,
        totalEvents: 0,
        syncedCount: 0,
        conflictsCount: 0,
        failuresCount: 0,
        status: "completed",
        details: { conflicts: [], failures: [] },
      };
    }

    const neonDb = manager.getNeonDb();

    // 4. Process events deterministically in dependency order
    for (const event of sortedEvents) {
      try {
        const payload = JSON.parse(event.payloadJson);
        const conflict = await detectConflict(neonDb, event.entityType, event.entityId, event.operation, payload, Number(event.createdAt));

        if (conflict) {
          conflicts.push({
            eventId: event.id,
            entityType: event.entityType,
            entityId: event.entityId,
            reason: conflict.reason,
          });

          await db
            .update(dbSyncOutbox)
            .set({
              status: "conflict",
              conflictDetails: JSON.stringify(conflict),
            })
            .where(eq(dbSyncOutbox.id, event.id));
          continue;
        }

        // Apply non-conflicting mutation to Neon Primary
        await applyMutationToNeon(neonDb, event.entityType, event.entityId, event.operation, payload);

        syncedCount++;
        await db
          .update(dbSyncOutbox)
          .set({
            status: "synced",
            syncedAt: Date.now(),
          })
          .where(eq(dbSyncOutbox.id, event.id));
      } catch (err: any) {
        failures.push({
          eventId: event.id,
          entityType: event.entityType,
          entityId: event.entityId,
          error: err.message || "Unknown error applying mutation",
        });

        await db
          .update(dbSyncOutbox)
          .set({
            status: "failed",
            retryCount: event.retryCount + 1,
            errorMessage: err.message || "Error applying mutation to primary database",
          })
          .where(eq(dbSyncOutbox.id, event.id));
      }
    }

    const finalStatus: "completed" | "partial" | "failed" =
      failures.length === sortedEvents.length
        ? "failed"
        : conflicts.length > 0 || failures.length > 0
        ? "partial"
        : "completed";

    await db
      .update(dbSyncHistory)
      .set({
        syncedCount,
        conflictsCount: conflicts.length,
        failuresCount: failures.length,
        status: finalStatus,
        completedAt: Date.now(),
        detailsJson: JSON.stringify({ conflicts, failures }),
      })
      .where(eq(dbSyncHistory.id, historyId));

    manager.saveControlPlaneState({
      lastSyncAt: Date.now(),
      lastSyncStatus: finalStatus,
    });

    return {
      historyId,
      fencingToken: state.fencingToken,
      totalEvents: sortedEvents.length,
      syncedCount,
      conflictsCount: conflicts.length,
      failuresCount: failures.length,
      status: finalStatus,
      details: { conflicts, failures },
    };
  } finally {
    isSyncRunning = false;
  }
}

/**
 * Domain-aware conflict detection before applying mutations to Neon PostgreSQL.
 * Validates business priorities rather than relying only on timestamps.
 */
async function detectConflict(
  neonDb: any,
  entityType: string,
  entityId: string,
  operation: string,
  payload: any,
  fallbackCreatedAt: number
): Promise<{ reason: string; targetData?: any } | null> {
  const neonPg = require("@/db/schema.pg");
  const entityKey = entityType.toLowerCase();
  const exportName = getSchemaExportName(entityKey);
  const targetTable = (neonPg as any)[exportName];

  if (!targetTable) {
    return null;
  }

  try {
    const existing = await neonDb
      .select()
      .from(targetTable)
      .where(eq(targetTable.id, entityId))
      .limit(1);

    const targetRecord = existing[0];

    if (operation === "INSERT") {
      if (targetRecord) {
        // If exact same record exists, report conflict if states differ
        return {
          reason: `Target record already exists in Neon PostgreSQL with conflicting state.`,
          targetData: targetRecord,
        };
      }
    } else if (operation === "UPDATE") {
      if (!targetRecord) {
        return {
          reason: `Target record does not exist in Neon PostgreSQL for update operation.`,
        };
      }

      // Domain-Aware Rule 1: Order Status Progression & Payment Protection
      if (entityKey === "orders") {
        const targetPayment = targetRecord.paymentStatus?.toLowerCase();
        const incomingPayment = payload.paymentStatus?.toLowerCase();
        if (targetPayment === "paid" && incomingPayment && incomingPayment !== "paid") {
          return {
            reason: `Neon PostgreSQL order is already verified as Paid. Refusing to downgrade payment status to '${incomingPayment}'.`,
            targetData: targetRecord,
          };
        }

        // Terminal order state protection
        const terminalOrderStates = ["delivered", "cancelled", "completed"];
        if (terminalOrderStates.includes(targetRecord.orderStatus) && payload.orderStatus === "pending") {
          return {
            reason: `Neon PostgreSQL order is in terminal state '${targetRecord.orderStatus}'. Refusing to revert to 'pending'.`,
            targetData: targetRecord,
          };
        }
      }

      // Domain-Aware Rule 2: Payment Submissions Verification Protection
      if (entityKey === "payment_submissions" || entityKey === "payments") {
        const targetStatus = targetRecord.status?.toLowerCase();
        const incomingStatus = payload.status?.toLowerCase();
        if ((targetStatus === "verified" || targetStatus === "paid") && incomingStatus && incomingStatus !== targetStatus) {
          return {
            reason: `Payment record in Neon PostgreSQL is already '${targetStatus}'. Refusing to overwrite.`,
            targetData: targetRecord,
          };
        }
      }

      // Domain-Aware Rule 3: Refund Settlement & Return Protection
      if (entityKey === "order_returns") {
        if (targetRecord.refundStatus === "paid" && payload.refundStatus !== "paid") {
          return {
            reason: `Refund in Neon PostgreSQL has already completed payout settlement. Refusing to downgrade to '${payload.refundStatus}'.`,
            targetData: targetRecord,
          };
        }
      }

      // Domain-Aware Rule 4: Timestamp Check for other entities
      const targetUpdatedAt = Number(targetRecord.updatedAt || targetRecord.createdAt || 0);
      if (targetUpdatedAt > fallbackCreatedAt) {
        return {
          reason: `Target record in Neon PostgreSQL was modified more recently (${new Date(
            targetUpdatedAt
          ).toISOString()}) than the fallback mutation (${new Date(fallbackCreatedAt).toISOString()}).`,
          targetData: targetRecord,
        };
      }
    }

    return null;
  } catch (err: any) {
    return {
      reason: `Could not verify target record due to check failure: ${err.message}`,
    };
  }
}

/**
 * Map entity type string to schema export name.
 */
function getSchemaExportName(entityType: string): string {
  const map: Record<string, string> = {
    users: "users",
    user_addresses: "userAddresses",
    product_categories: "productCategories",
    products: "products",
    product_images: "productImages",
    orders: "orders",
    order_items: "orderItems",
    order_files: "orderFiles",
    payments: "payments",
    payment_submissions: "paymentSubmissions",
    order_returns: "orderReturns",
    order_return_items: "orderReturnItems",
    service_prices: "servicePrices",
    notifications: "notifications",
    audit_logs: "auditLogs",
  };
  return map[entityType] || entityType;
}

/**
 * Apply mutation safely to Neon PostgreSQL using strict allowlisting and safe parameterization.
 */
async function applyMutationToNeon(
  neonDb: any,
  entityType: string,
  entityId: string,
  operation: string,
  payload: any
): Promise<void> {
  const neonPg = require("@/db/schema.pg");
  const entityKey = entityType.toLowerCase();
  const allowedFields = TABLE_FIELD_ALLOWLIST[entityKey];

  if (!allowedFields) {
    throw new Error(`Safety violation: Entity type '${entityType}' is not in the allowed synchronization list.`);
  }

  const exportName = getSchemaExportName(entityKey);
  const targetTable = (neonPg as any)[exportName];

  if (!targetTable) {
    throw new Error(`Target PostgreSQL table model not found for entity type '${entityType}' (export: ${exportName})`);
  }

  // Filter payload to only allowed columns
  const safePayload: Record<string, any> = {};
  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      safePayload[field] = payload[field];
    }
  }

  if (operation === "INSERT") {
    // Idempotency: check if already exists
    const existing = await neonDb
      .select({ id: targetTable.id })
      .from(targetTable)
      .where(eq(targetTable.id, entityId))
      .limit(1);

    if (existing.length > 0) {
      // Idempotent duplicate: update with latest safe payload
      await neonDb.update(targetTable).set(safePayload).where(eq(targetTable.id, entityId));
    } else {
      await neonDb.insert(targetTable).values(safePayload);
    }
  } else if (operation === "UPDATE") {
    await neonDb.update(targetTable).set(safePayload).where(eq(targetTable.id, entityId));
  } else if (operation === "DELETE") {
    await neonDb.delete(targetTable).where(eq(targetTable.id, entityId));
  }
}
