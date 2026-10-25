import { describe, it, expect, beforeAll } from "vitest";
import { generateOrderReference } from "../src/lib/utils";
import { db } from "../src/db";
import { orders, orderItems, users } from "../src/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

describe("Order Lifecycle & Snapshot Rules", () => {
  beforeAll(async () => {
    await db
      .insert(users)
      .values({
        id: "usr_cust_001",
        fullName: "Test Customer",
        email: "cust001@example.com",
        phone: "9876543211",
        passwordHash: "hash123",
        role: "customer",
        isEmailVerified: true,
        isPhoneVerified: true,
      })
      .onConflictDoNothing();
  });
  it("should generate unique, human-readable order references formatted like BS-YYMM-XXXX", () => {
    const ref1 = generateOrderReference();
    const ref2 = generateOrderReference();

    expect(ref1).toMatch(/^BS-\d{4}-\d{4}$/);
    expect(ref2).toMatch(/^BS-\d{4}-\d{4}$/);
    expect(ref1).not.toEqual(ref2);
  });

  it("should persist immutable historical price snapshots for order items", async () => {
    const orderId = `ord_test_${crypto.randomUUID()}`;
    const ref = generateOrderReference();

    // Create order
    await db.insert(orders).values({
      id: orderId,
      orderReference: ref,
      customerId: "usr_cust_001",
      orderType: "print_service",
      subtotal: 100,
      discount: 0,
      additionalCharges: 0,
      totalAmount: 100,
      paymentStatus: "unpaid",
      paymentMethod: "cash_on_collection",
      orderStatus: "pending",
      deliveryType: "store_pickup",
    });

    // Create order item with price snapshot
    const itemId = `itm_test_${crypto.randomUUID()}`;
    await db.insert(orderItems).values({
      id: itemId,
      orderId,
      itemType: "pvc_card",
      serviceId: "srv_pvc",
      configurationJson: JSON.stringify({ documentType: "aadhaar" }),
      quantity: 2,
      pageCount: 1,
      unitPriceSnapshot: 50,
      totalPriceSnapshot: 100,
    });

    const savedItems = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    expect(savedItems.length).toBe(1);
    expect(savedItems[0].unitPriceSnapshot).toBe(50);
    expect(savedItems[0].totalPriceSnapshot).toBe(100);

    // Verify payment status and order status are distinct attributes
    const savedOrder = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId));

    expect(savedOrder[0].paymentStatus).toBe("unpaid");
    expect(savedOrder[0].orderStatus).toBe("pending");
  });
});
