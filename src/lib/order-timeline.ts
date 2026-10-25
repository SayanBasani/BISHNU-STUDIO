import { db } from "@/db";
import { orderStatusHistory, users } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import crypto from "crypto";

export interface RecordOrderEventParams {
  orderId: string;
  previousStatus?: string | null;
  newStatus: string;
  previousPaymentStatus?: string | null;
  newPaymentStatus?: string | null;
  changedByUserId?: string | null;
  actorRole?: "customer" | "admin" | "system";
  customerMessage?: string | null;
  internalNote?: string | null;
}

export async function recordOrderEvent(params: RecordOrderEventParams) {
  try {
    const id = `evt_${crypto.randomUUID()}`;
    await db.insert(orderStatusHistory).values({
      id,
      orderId: params.orderId,
      previousStatus: params.previousStatus || null,
      newStatus: params.newStatus,
      previousPaymentStatus: params.previousPaymentStatus || null,
      newPaymentStatus: params.newPaymentStatus || null,
      changedByUserId: params.changedByUserId || null,
      actorRole: params.actorRole || "system",
      customerMessage: params.customerMessage || null,
      internalNote: params.internalNote || null,
      createdAt: Date.now(),
    });
    return id;
  } catch (error) {
    console.error("Failed to record order event:", error);
    return null;
  }
}

export async function getOrderTimeline(orderId: string) {
  try {
    const events = await db
      .select({
        id: orderStatusHistory.id,
        orderId: orderStatusHistory.orderId,
        previousStatus: orderStatusHistory.previousStatus,
        newStatus: orderStatusHistory.newStatus,
        previousPaymentStatus: orderStatusHistory.previousPaymentStatus,
        newPaymentStatus: orderStatusHistory.newPaymentStatus,
        actorRole: orderStatusHistory.actorRole,
        customerMessage: orderStatusHistory.customerMessage,
        internalNote: orderStatusHistory.internalNote,
        createdAt: orderStatusHistory.createdAt,
        changedByName: users.fullName,
      })
      .from(orderStatusHistory)
      .leftJoin(users, eq(orderStatusHistory.changedByUserId, users.id))
      .where(eq(orderStatusHistory.orderId, orderId))
      .orderBy(asc(orderStatusHistory.createdAt));

    return events;
  } catch (error) {
    console.error("Failed to retrieve order timeline:", error);
    return [];
  }
}
