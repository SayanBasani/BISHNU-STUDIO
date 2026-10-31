import crypto from "crypto";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq, and, or, isNull, desc, count, sql } from "drizzle-orm";

export type NotificationRecipientType = "admin" | "customer";
export type NotificationCategory =
  | "order"
  | "payment"
  | "delivery"
  | "return"
  | "account"
  | "system";
export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface CreateNotificationInput {
  recipientType: NotificationRecipientType;
  recipientId?: string | null;
  category: NotificationCategory;
  eventType: string;
  title: string;
  message: string;
  entityType?: "order" | "payment" | "return" | "user" | "setting" | "system";
  entityId?: string | null;
  linkUrl?: string | null;
  priority?: NotificationPriority;
  deduplicationKey?: string | null;
}

export async function createNotification(input: CreateNotificationInput) {
  const now = Date.now();

  // Deduplication check: if a deduplication key is provided, prevent duplicate notifications
  if (input.deduplicationKey) {
    const existing = await db
      .select()
      .from(notifications)
      .where(eq(notifications.deduplicationKey, input.deduplicationKey))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }
  }

  const id = `notif_${crypto.randomUUID()}`;

  const newNotif = {
    id,
    recipientType: input.recipientType,
    recipientId: input.recipientId || null,
    category: input.category,
    eventType: input.eventType,
    title: input.title.trim(),
    message: input.message.trim(),
    entityType: input.entityType || "system",
    entityId: input.entityId || null,
    linkUrl: input.linkUrl || null,
    isRead: false,
    readAt: null,
    priority: input.priority || "normal",
    deduplicationKey: input.deduplicationKey || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(notifications).values(newNotif);

  return newNotif;
}

export async function getNotifications(options: {
  recipientType: NotificationRecipientType;
  recipientId?: string | null;
  isRead?: boolean;
  category?: string;
  limit?: number;
  offset?: number;
}) {
  const {
    recipientType,
    recipientId,
    isRead,
    category,
    limit = 50,
    offset = 0,
  } = options;

  const conditions = [];

  if (recipientType === "customer") {
    if (!recipientId) {
      throw new Error("recipientId is required for customer notification queries");
    }
    conditions.push(
      and(
        eq(notifications.recipientType, "customer"),
        eq(notifications.recipientId, recipientId)
      )
    );
  } else {
    // Admin notifications: include targeted to this admin OR broadcast (recipientId is null)
    if (recipientId) {
      conditions.push(
        and(
          eq(notifications.recipientType, "admin"),
          or(eq(notifications.recipientId, recipientId), isNull(notifications.recipientId))
        )
      );
    } else {
      conditions.push(eq(notifications.recipientType, "admin"));
    }
  }

  if (typeof isRead === "boolean") {
    conditions.push(eq(notifications.isRead, isRead));
  }

  if (category && category !== "all") {
    conditions.push(eq(notifications.category, category as any));
  }

  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  const [items, unreadCount] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset),
    getUnreadNotificationCount({
      recipientType,
      recipientId,
    }),
  ]);

  return {
    items,
    unreadCount,
    limit,
    offset,
  };
}

export async function getUnreadNotificationCount(options: {
  recipientType: NotificationRecipientType;
  recipientId?: string | null;
}): Promise<number> {
  const { recipientType, recipientId } = options;

  let whereClause;
  if (recipientType === "customer") {
    if (!recipientId) return 0;
    whereClause = and(
      eq(notifications.recipientType, "customer"),
      eq(notifications.recipientId, recipientId),
      eq(notifications.isRead, false)
    );
  } else {
    // Admin unread
    if (recipientId) {
      whereClause = and(
        eq(notifications.recipientType, "admin"),
        or(eq(notifications.recipientId, recipientId), isNull(notifications.recipientId)),
        eq(notifications.isRead, false)
      );
    } else {
      whereClause = and(
        eq(notifications.recipientType, "admin"),
        eq(notifications.isRead, false)
      );
    }
  }

  const countResult = await db
    .select({ total: count() })
    .from(notifications)
    .where(whereClause);

  return Number(countResult[0]?.total || 0);
}

export async function markNotificationAsRead(
  notificationId: string,
  options: {
    recipientType: NotificationRecipientType;
    recipientId?: string | null;
  }
) {
  const { recipientType, recipientId } = options;

  // Authorization verification: verify that the notification belongs to this recipient
  const notifRows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);

  if (notifRows.length === 0) {
    return { success: false, error: "Notification not found" };
  }

  const notif = notifRows[0];

  if (recipientType === "customer") {
    if (notif.recipientType !== "customer" || notif.recipientId !== recipientId) {
      return { success: false, error: "Unauthorized access to notification" };
    }
  } else {
    // Admin check
    if (notif.recipientType !== "admin") {
      return { success: false, error: "Unauthorized access to notification" };
    }
  }

  // Idempotency: if already read, avoid redundant database update
  if (notif.isRead) {
    return { success: true, notificationId, alreadyRead: true };
  }

  const now = Date.now();
  await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: now,
      updatedAt: now,
    })
    .where(eq(notifications.id, notificationId));

  return { success: true, notificationId };
}

export async function markAllNotificationsAsRead(options: {
  recipientType: NotificationRecipientType;
  recipientId?: string | null;
  category?: string;
}) {
  const { recipientType, recipientId, category } = options;
  const now = Date.now();

  const conditions = [eq(notifications.isRead, false)];

  if (recipientType === "customer") {
    if (!recipientId) return { success: false, updatedCount: 0 };
    conditions.push(
      eq(notifications.recipientType, "customer"),
      eq(notifications.recipientId, recipientId)
    );
  } else {
    // Admin
    if (recipientId) {
      conditions.push(
        eq(notifications.recipientType, "admin"),
        or(eq(notifications.recipientId, recipientId), isNull(notifications.recipientId)) as any
      );
    } else {
      conditions.push(eq(notifications.recipientType, "admin"));
    }
  }

  if (category && category !== "all") {
    conditions.push(eq(notifications.category, category as any));
  }

  await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: now,
      updatedAt: now,
    })
    .where(and(...conditions));

  return { success: true };
}

export async function deleteNotification(
  notificationId: string,
  options: {
    recipientType: NotificationRecipientType;
    recipientId?: string | null;
  }
) {
  const { recipientType, recipientId } = options;

  const notifRows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, notificationId))
    .limit(1);

  if (notifRows.length === 0) {
    return { success: false, error: "Notification not found" };
  }

  const notif = notifRows[0];
  if (recipientType === "customer") {
    if (notif.recipientType !== "customer" || notif.recipientId !== recipientId) {
      return { success: false, error: "Unauthorized access to notification" };
    }
  } else if (notif.recipientType !== "admin") {
    return { success: false, error: "Unauthorized access to notification" };
  }

  await db.delete(notifications).where(eq(notifications.id, notificationId));
  return { success: true };
}
