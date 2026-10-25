import { db } from "@/db";
import { auditLogs, authenticationEvents } from "@/db/schema";
import crypto from "crypto";

export interface LogAuditEventParams {
  userId?: string | null;
  action: string;
  entityType:
    | "order"
    | "product"
    | "pricing"
    | "user"
    | "file"
    | "auth"
    | "settings"
    | "payment"
    | "account_appeal"
    | "product_review";
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
}

export async function logAuditEvent(params: LogAuditEventParams) {
  try {
    await db.insert(auditLogs).values({
      id: `aud_${crypto.randomUUID()}`,
      userId: params.userId || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId || null,
      detailsJson: params.details ? JSON.stringify(params.details) : null,
      ipAddress: params.ipAddress || null,
      createdAt: Date.now(),
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

export interface LogAuthEventParams {
  userId?: string | null;
  email: string;
  eventType:
    | "login_success"
    | "login_failure"
    | "logout"
    | "admin_login_success"
    | "admin_login_failure"
    | "password_reset_request"
    | "password_reset_complete";
  ipAddress?: string;
  userAgent?: string;
  status?: "success" | "failure";
  failureReason?: string;
  metadata?: Record<string, any>;
}

export async function logAuthEvent(params: LogAuthEventParams) {
  try {
    await db.insert(authenticationEvents).values({
      id: `auth_evt_${crypto.randomUUID()}`,
      userId: params.userId || null,
      email: params.email,
      eventType: params.eventType,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
      status: params.status || "success",
      failureReason: params.failureReason || null,
      metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
      createdAt: Date.now(),
    });
  } catch (err) {
    console.error("Failed to write auth event log:", err);
  }
}
