import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "../src/lib/notifications";
import { db } from "../src/db";
import { users, notifications } from "../src/db/schema";
import { eq, or } from "drizzle-orm";
import crypto from "crypto";

describe("Persistent Notifications Engine & Authorization Security", () => {
  const customerA = `usr_cust_a_${crypto.randomUUID().slice(0, 8)}`;
  const customerB = `usr_cust_b_${crypto.randomUUID().slice(0, 8)}`;
  const adminId = `usr_adm_${crypto.randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    // Insert test users
    await db.insert(users).values([
      {
        id: customerA,
        fullName: "Customer A",
        email: "customer.a@test.com",
        phone: `93${Date.now().toString().slice(-8)}`,
        passwordHash: "hash123",
        role: "customer",
        status: "active",
        isEmailVerified: true,
        isPhoneVerified: true,
      },
      {
        id: customerB,
        fullName: "Customer B",
        email: "customer.b@test.com",
        phone: `94${Date.now().toString().slice(-8)}`,
        passwordHash: "hash123",
        role: "customer",
        status: "active",
        isEmailVerified: true,
        isPhoneVerified: true,
      },
      {
        id: adminId,
        fullName: "Admin User",
        email: "admin.user@test.com",
        phone: `95${Date.now().toString().slice(-8)}`,
        passwordHash: "hash123",
        role: "admin",
        status: "active",
        isEmailVerified: true,
        isPhoneVerified: true,
      },
    ]);
  });

  afterAll(async () => {
    await db
      .delete(notifications)
      .where(
        or(
          eq(notifications.recipientId, customerA),
          eq(notifications.recipientId, customerB),
          eq(notifications.recipientType, "admin")
        )
      );
    await db.delete(users).where(eq(users.id, customerA));
    await db.delete(users).where(eq(users.id, customerB));
    await db.delete(users).where(eq(users.id, adminId));
  });

  it("should create notifications with correct category, eventType, and priority", async () => {
    const custNotif = await createNotification({
      recipientType: "customer",
      recipientId: customerA,
      category: "order",
      eventType: "order_created",
      title: "Order Placed (#BS-1001)",
      message: "Your order for ₹1,250 has been placed.",
      entityType: "order",
      entityId: "ord_1001",
      linkUrl: "/account/orders/ord_1001",
      priority: "normal",
    });

    expect(custNotif).toBeDefined();
    expect(custNotif.id.startsWith("notif_")).toBe(true);
    expect(custNotif.recipientId).toBe(customerA);
    expect(custNotif.isRead).toBe(false);

    const adminNotif = await createNotification({
      recipientType: "admin",
      category: "payment",
      eventType: "payment_proof_submitted",
      title: "Payment Proof Submitted (#BS-1001)",
      message: "Customer submitted UTR 987654321012 for ₹1,250.",
      entityType: "payment",
      entityId: "pay_1001",
      linkUrl: "/admin/orders/ord_1001",
      priority: "high",
    });

    expect(adminNotif).toBeDefined();
    expect(adminNotif.recipientType).toBe("admin");
    expect(adminNotif.priority).toBe("high");
  });

  it("should enforce deduplication via deduplicationKey to prevent alert spam", async () => {
    const dedupKey = `dedup_${crypto.randomUUID()}`;

    const first = await createNotification({
      recipientType: "customer",
      recipientId: customerA,
      category: "payment",
      eventType: "payment_reminder",
      title: "Payment Reminder",
      message: "Please complete your payment.",
      deduplicationKey: dedupKey,
    });

    const second = await createNotification({
      recipientType: "customer",
      recipientId: customerA,
      category: "payment",
      eventType: "payment_reminder",
      title: "Payment Reminder (Duplicate)",
      message: "Please complete your payment.",
      deduplicationKey: dedupKey,
    });

    expect(second.id).toBe(first.id);
  });

  it("should strictly enforce recipient authorization (Customer A cannot see Customer B or Admin notifications)", async () => {
    // Create notification for Customer B
    await createNotification({
      recipientType: "customer",
      recipientId: customerB,
      category: "account",
      eventType: "password_changed",
      title: "Customer B Alert",
      message: "Private notification for Customer B.",
    });

    // Query notifications for Customer A
    const custAResult = await getNotifications({
      recipientType: "customer",
      recipientId: customerA,
    });

    // Customer A must ONLY see Customer A's notifications
    expect(custAResult.items.length).toBeGreaterThanOrEqual(1);
    for (const item of custAResult.items) {
      expect(item.recipientType).toBe("customer");
      expect(item.recipientId).toBe(customerA);
      expect(item.recipientId).not.toBe(customerB);
    }

    // Customer B unread count
    const custBUnread = await getUnreadNotificationCount({
      recipientType: "customer",
      recipientId: customerB,
    });
    expect(custBUnread).toBe(1);

    // Admin query
    const adminResult = await getNotifications({
      recipientType: "admin",
      recipientId: adminId,
    });
    for (const item of adminResult.items) {
      expect(item.recipientType).toBe("admin");
    }
  });

  it("should prevent unauthorized customers from marking other users' notifications as read", async () => {
    // Create notification for Customer B
    const notifB = await createNotification({
      recipientType: "customer",
      recipientId: customerB,
      category: "delivery",
      eventType: "order_dispatched",
      title: "Order Dispatched",
      message: "Your package is on the way.",
    });

    // Customer A attempts to mark Customer B's notification as read
    const hijackAttempt = await markNotificationAsRead(notifB.id, {
      recipientType: "customer",
      recipientId: customerA, // unauthorized!
    });

    expect(hijackAttempt.success).toBe(false);
    expect(hijackAttempt.error).toContain("Unauthorized");

    // Customer B legitimately marks it as read
    const legitRead = await markNotificationAsRead(notifB.id, {
      recipientType: "customer",
      recipientId: customerB,
    });
    expect(legitRead.success).toBe(true);
  });

  it("should mark all notifications as read and allow safe notification deletion", async () => {
    // Create two unread notifications for Customer A
    const n1 = await createNotification({
      recipientType: "customer",
      recipientId: customerA,
      category: "return",
      eventType: "return_approved",
      title: "Return Approved",
      message: "Your return has been approved.",
    });
    const n2 = await createNotification({
      recipientType: "customer",
      recipientId: customerA,
      category: "return",
      eventType: "refund_processed",
      title: "Refund Processed",
      message: "Your refund of ₹500 has been sent.",
    });

    const unreadBefore = await getUnreadNotificationCount({
      recipientType: "customer",
      recipientId: customerA,
    });
    expect(unreadBefore).toBeGreaterThanOrEqual(2);

    // Mark all as read
    const markAllResult = await markAllNotificationsAsRead({
      recipientType: "customer",
      recipientId: customerA,
    });
    expect(markAllResult.success).toBe(true);

    const unreadAfter = await getUnreadNotificationCount({
      recipientType: "customer",
      recipientId: customerA,
    });
    expect(unreadAfter).toBe(0);

    // Delete single notification
    const delResult = await deleteNotification(n1.id, {
      recipientType: "customer",
      recipientId: customerA,
    });
    expect(delResult.success).toBe(true);

    // Verify n1 is deleted
    const deletedCheck = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, n1.id));
    expect(deletedCheck.length).toBe(0);
  });
});
