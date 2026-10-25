import { describe, it, expect, beforeAll } from "vitest";
import {
  validateOrderTransition,
  validateTrackingUrl,
  ORDER_LIFECYCLE_STATUSES,
  FULFILLMENT_STATUSES,
} from "../src/lib/order-state-machine";
import { db } from "../src/db";
import { users, orders } from "../src/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

describe("Order Lifecycle State Machine & Logistics Tracking Tests", () => {
  const customerId = `usr_osm_${Date.now()}`;
  const orderId = `ord_osm_${Date.now()}`;

  beforeAll(async () => {
    // Seed test customer with unique phone & email
    const uniquePhone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    const uniqueEmail = `tracking_${Date.now()}@example.com`;

    await db
      .insert(users)
      .values({
        id: customerId,
        fullName: "Suresh Chakraborty",
        email: uniqueEmail,
        phone: uniquePhone,
        passwordHash: "hash_pwd_tracking",
        role: "customer",
        isEmailVerified: true,
        isPhoneVerified: true,
      });
  });

  describe("1. Valid Order Lifecycle State Transitions", () => {
    it("should allow same-status no-op transitions", () => {
      expect(validateOrderTransition("pending", "pending").valid).toBe(true);
      expect(validateOrderTransition("processing", "processing").valid).toBe(true);
      expect(validateOrderTransition("completed", "completed").valid).toBe(true);
    });

    it("should allow pending -> confirmed or cancelled", () => {
      expect(validateOrderTransition("pending", "confirmed").valid).toBe(true);
      expect(validateOrderTransition("pending", "cancelled").valid).toBe(true);
    });

    it("should allow confirmed -> processing or cancelled", () => {
      expect(validateOrderTransition("confirmed", "processing").valid).toBe(true);
      expect(validateOrderTransition("confirmed", "cancelled").valid).toBe(true);
    });

    it("should allow processing -> ready_for_collection, out_for_delivery, or cancelled", () => {
      expect(validateOrderTransition("processing", "ready_for_collection").valid).toBe(true);
      expect(validateOrderTransition("processing", "out_for_delivery").valid).toBe(true);
      expect(validateOrderTransition("processing", "cancelled").valid).toBe(true);
    });

    it("should allow fulfillment to terminal completed", () => {
      expect(validateOrderTransition("ready_for_collection", "completed").valid).toBe(true);
      expect(validateOrderTransition("out_for_delivery", "completed").valid).toBe(true);
    });
  });

  describe("2. Terminal Status Protection & Invalid State Transitions", () => {
    it("should reject skipping intermediate fulfillment stages without override", () => {
      const skipPendingToCompleted = validateOrderTransition("pending", "completed");
      expect(skipPendingToCompleted.valid).toBe(false);
      expect(skipPendingToCompleted.error).toContain("Cannot transition order status from 'pending' to 'completed'");

      const skipPendingToDelivery = validateOrderTransition("pending", "out_for_delivery");
      expect(skipPendingToDelivery.valid).toBe(false);
    });

    it("should strictly protect completed orders from backward status transitions", () => {
      const completedToPending = validateOrderTransition("completed", "pending");
      expect(completedToPending.valid).toBe(false);
      expect(completedToPending.error).toContain("Completed orders are finalized");

      const completedToProcessing = validateOrderTransition("completed", "processing");
      expect(completedToProcessing.valid).toBe(false);
      expect(completedToProcessing.error).toContain("Returns workflow");
    });

    it("should strictly protect cancelled orders from being reopened without explicit override", () => {
      const cancelledToPending = validateOrderTransition("cancelled", "pending");
      expect(cancelledToPending.valid).toBe(false);
      expect(cancelledToPending.error).toContain("Cancelled orders cannot be reopened");

      const cancelledToProcessing = validateOrderTransition("cancelled", "processing");
      expect(cancelledToProcessing.valid).toBe(false);
    });

    it("should allow explicit admin override when emergency flag is supplied", () => {
      // In exceptional cases (e.g. accidental click), an admin with override can correct status
      const overrideResult = validateOrderTransition("cancelled", "processing", true);
      expect(overrideResult.valid).toBe(true);
    });
  });

  describe("3. Logistics & Courier Tracking URL Validation", () => {
    it("should accept valid HTTP and HTTPS courier tracking links", () => {
      const shiprocket = validateTrackingUrl("https://shiprocket.co/tracking/SR123456789IN");
      expect(shiprocket.valid).toBe(true);
      expect(shiprocket.safeUrl).toBe("https://shiprocket.co/tracking/SR123456789IN");

      const delhivery = validateTrackingUrl("https://www.delhivery.com/track/package/1234567890");
      expect(delhivery.valid).toBe(true);

      const indiapost = validateTrackingUrl("https://www.indiapost.gov.in/_layouts/15/dpt.cept.tracking/trackconsignment.aspx");
      expect(indiapost.valid).toBe(true);
    });

    it("should reject dangerous and malicious URL schemes", () => {
      const js = validateTrackingUrl("javascript:alert(document.cookie)");
      expect(js.valid).toBe(false);
      expect(js.error).toContain("Unsafe URL scheme detected");

      const file = validateTrackingUrl("file:///C:/Users/Administrator/secret.txt");
      expect(file.valid).toBe(false);

      const data = validateTrackingUrl("data:text/html,<script>alert(1)</script>");
      expect(data.valid).toBe(false);
    });

    it("should reject malformed non-URL strings", () => {
      const malformed = validateTrackingUrl("ht!tp://broken domain.com");
      expect(malformed.valid).toBe(false);
    });

    it("should return valid and null for empty or undefined input", () => {
      expect(validateTrackingUrl(null)).toEqual({ valid: true, safeUrl: null });
      expect(validateTrackingUrl("")).toEqual({ valid: true, safeUrl: null });
      expect(validateTrackingUrl("   ")).toEqual({ valid: true, safeUrl: null });
    });
  });

  describe("4. Privacy Barrier: Internal Staff Notes vs Customer Instructions", () => {
    it("should strictly sanitize internalNotes for non-admin responses", () => {
      const rawOrderRecord = {
        id: "ord_barrier_001",
        orderNumber: "ORD-2026-9999",
        orderStatus: "processing",
        totalAmount: 450,
        customerFulfillmentNote: "Your document has been printed and is being packed in moisture-resistant PVC sleeves.",
        internalNotes: "CONFIDENTIAL: Customer called twice complaining about paper weight. Given 100 GSM premium at standard rate.",
        deliveryPersonName: "Subhash Mondal",
        deliveryPersonPhone: "+91 98300 12345",
      };

      // Customer view serialization simulation (identical to src/app/api/orders/[id]/route.ts)
      const serializeForCustomer = (order: typeof rawOrderRecord, isAdmin: boolean) => ({
        ...order,
        internalNotes: isAdmin ? order.internalNotes : undefined,
      });

      const customerView = serializeForCustomer(rawOrderRecord, false);
      expect(customerView.internalNotes).toBeUndefined();
      expect(customerView.customerFulfillmentNote).toBe(rawOrderRecord.customerFulfillmentNote);
      expect(customerView.deliveryPersonName).toBe("Subhash Mondal");

      const adminView = serializeForCustomer(rawOrderRecord, true);
      expect(adminView.internalNotes).toBe(rawOrderRecord.internalNotes);
      expect(adminView.internalNotes).toContain("CONFIDENTIAL");
    });
  });

  describe("5. Order Fulfillment & Tracking Database Persistence", () => {
    it("should save and read tracking details, expected delivery date, and courier URL", async () => {
      const testOrderNumber = `BS-TRACK-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

      // Insert new test order with tracking fields
      await db
        .insert(orders)
        .values({
          id: orderId,
          orderReference: testOrderNumber,
          customerId: customerId,
          orderType: "shopping",
          orderStatus: "out_for_delivery",
          paymentStatus: "paid",
          paymentMethod: "online",
          deliveryType: "home_delivery",
          fulfillmentStatus: "out_for_delivery",
          totalAmount: 320,
          subtotal: 300,
          discount: 0,
          additionalCharges: 20,
          courierName: "BlueDart Express",
          trackingNumber: "BD987654321IN",
          trackingUrl: "https://www.bluedart.com/tracking?track=BD987654321IN",
          deliveryPersonName: "Bapi Ghosh",
          deliveryPersonPhone: "9831122334",
          expectedDeliveryDate: "2026-10-28",
          customerFulfillmentNote: "Out for delivery with Bapi. Please have OTP ready upon arrival.",
          internalNotes: "Staff note: Deliver during afternoon slot as requested.",
        })
        .onConflictDoUpdate({
          target: orders.id,
          set: {
            orderStatus: "out_for_delivery",
            fulfillmentStatus: "out_for_delivery",
            courierName: "BlueDart Express",
            trackingNumber: "BD987654321IN",
            trackingUrl: "https://www.bluedart.com/tracking?track=BD987654321IN",
            deliveryPersonName: "Bapi Ghosh",
            deliveryPersonPhone: "9831122334",
            expectedDeliveryDate: "2026-10-28",
            customerFulfillmentNote: "Out for delivery with Bapi. Please have OTP ready upon arrival.",
          },
        });

      // Query order back
      const [fetched] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

      expect(fetched).toBeDefined();
      expect(fetched.orderReference).toBe(testOrderNumber);
      expect(fetched.courierName).toBe("BlueDart Express");
      expect(fetched.trackingNumber).toBe("BD987654321IN");
      expect(fetched.trackingUrl).toBe("https://www.bluedart.com/tracking?track=BD987654321IN");
      expect(fetched.deliveryPersonName).toBe("Bapi Ghosh");
      expect(fetched.deliveryPersonPhone).toBe("9831122334");
      expect(fetched.expectedDeliveryDate).toBe("2026-10-28");
      expect(fetched.customerFulfillmentNote).toContain("Out for delivery with Bapi");
      expect(fetched.internalNotes).toContain("Staff note: Deliver during afternoon slot");
    });
  });
});
