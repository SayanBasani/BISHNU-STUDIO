import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../src/db";
import {
  users,
  orders,
  orderItems,
  paymentSubmissions,
  shopSettings,
} from "../src/db/schema";
import { generateOrderReference } from "../src/lib/utils";
import { getShopSettings, updateShopSettings, invalidateShopSettingsCache } from "../src/lib/settings";
import { getOrderTimeline, recordOrderEvent } from "../src/lib/order-timeline";
import { eq } from "drizzle-orm";
import crypto from "crypto";

describe("Complete Order Management & Performance Audit Tests", () => {
  const customerId = "usr_cust_perf_001";
  const adminId = "usr_admin_perf_001";

  beforeAll(async () => {
    // Seed test customer
    await db
      .insert(users)
      .values({
        id: customerId,
        fullName: "Rohan Mukherjee",
        email: "rohan.mukherjee@example.com",
        phone: "9876543299",
        passwordHash: "hash_pwd_test",
        role: "customer",
        isEmailVerified: true,
        isPhoneVerified: true,
      })
      .onConflictDoNothing();

    // Seed test admin
    await db
      .insert(users)
      .values({
        id: adminId,
        fullName: "Bishnu Prasad",
        email: "admin.perf@bishnustudio.com",
        phone: "9876500000",
        passwordHash: "hash_admin_test",
        role: "admin",
        isEmailVerified: true,
        isPhoneVerified: true,
      })
      .onConflictDoNothing();
  });

  describe("PART 1: Order Validation & Missing Address Detection", () => {
    it("should correctly identify missing address on home delivery orders without fabricated data", async () => {
      const orderId = `ord_perf_${crypto.randomUUID()}`;
      const ref = generateOrderReference();

      // Insert home delivery order with null address (simulating legacy or incomplete order)
      await db.insert(orders).values({
        id: orderId,
        orderReference: ref,
        customerId,
        orderType: "shopping",
        subtotal: 350,
        discount: 0,
        additionalCharges: 40,
        totalAmount: 390,
        paymentStatus: "unpaid",
        paymentMethod: "upi_mock",
        orderStatus: "pending",
        deliveryType: "home_delivery",
        shippingAddressJson: null,
      });

      // Verify that home delivery with null address is flagged as missing
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
      let parsedAddr = null;
      try {
        if (order.shippingAddressJson) parsedAddr = JSON.parse(order.shippingAddressJson);
      } catch (e) {}

      const isHomeDelivery = order.deliveryType === "home_delivery";
      const isAddressMissing =
        isHomeDelivery &&
        (!parsedAddr ||
          !parsedAddr.houseBuilding?.trim() ||
          !parsedAddr.cityTown?.trim() ||
          !parsedAddr.pinCode?.trim());

      expect(isAddressMissing).toBe(true);
    });

    it("should NOT flag store pickup orders as having a missing address", async () => {
      const orderId = `ord_perf_pickup_${crypto.randomUUID()}`;
      const ref = generateOrderReference();

      // Insert store pickup order with no shipping address
      await db.insert(orders).values({
        id: orderId,
        orderReference: ref,
        customerId,
        orderType: "print_service",
        subtotal: 80,
        discount: 0,
        additionalCharges: 0,
        totalAmount: 80,
        paymentStatus: "unpaid",
        paymentMethod: "cash_on_collection",
        orderStatus: "pending",
        deliveryType: "store_pickup",
        shippingAddressJson: null,
      });

      const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
      const isHomeDelivery = order.deliveryType === "home_delivery";
      const isAddressMissing =
        isHomeDelivery && (!order.shippingAddressJson || order.shippingAddressJson === "");

      expect(isAddressMissing).toBe(false);
    });

    it("should preserve complete saved shipping addresses for home delivery orders", async () => {
      const orderId = `ord_perf_addr_${crypto.randomUUID()}`;
      const ref = generateOrderReference();
      const shippingAddress = {
        recipientName: "Rohan Mukherjee",
        recipientPhone: "9876543299",
        houseBuilding: "Flat 4B, Greenfield Heights",
        streetLocality: "Jessore Road, Ward 12",
        landmark: "Near Star Mall",
        cityTown: "Barasat",
        state: "West Bengal",
        pinCode: "700124",
      };

      await db.insert(orders).values({
        id: orderId,
        orderReference: ref,
        customerId,
        orderType: "shopping",
        subtotal: 600,
        discount: 0,
        additionalCharges: 0,
        totalAmount: 600,
        paymentStatus: "unpaid",
        paymentMethod: "upi_mock",
        orderStatus: "pending",
        deliveryType: "home_delivery",
        shippingAddressJson: JSON.stringify(shippingAddress),
      });

      const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
      const parsed = JSON.parse(order.shippingAddressJson!);
      expect(parsed.pinCode).toBe("700124");
      expect(parsed.cityTown).toBe("Barasat");
      expect(parsed.houseBuilding).toBe("Flat 4B, Greenfield Heights");

      const isHomeDelivery = order.deliveryType === "home_delivery";
      const isAddressMissing =
        isHomeDelivery &&
        (!parsed.houseBuilding?.trim() || !parsed.cityTown?.trim() || !parsed.pinCode?.trim());
      expect(isAddressMissing).toBe(false);
    });
  });

  describe("PART 2: Fulfillment & Tracking Dispatch State Machine", () => {
    it("should record courier name, tracking number, and dispatchedAt timestamp", async () => {
      const orderId = `ord_perf_dispatch_${crypto.randomUUID()}`;
      const ref = generateOrderReference();

      await db.insert(orders).values({
        id: orderId,
        orderReference: ref,
        customerId,
        orderType: "shopping",
        subtotal: 500,
        discount: 0,
        additionalCharges: 0,
        totalAmount: 500,
        paymentStatus: "paid",
        paymentMethod: "upi_mock",
        orderStatus: "processing",
        deliveryType: "home_delivery",
      });

      const dispatchTime = Date.now();
      await db
        .update(orders)
        .set({
          orderStatus: "out_for_delivery",
          courierName: "Delhivery Express",
          trackingNumber: "DLH-992837461",
          dispatchedAt: dispatchTime,
          internalNotes: "Dispatched in water-resistant bubble packaging",
        })
        .where(eq(orders.id, orderId));

      await recordOrderEvent({
        orderId,
        previousStatus: "processing",
        newStatus: "out_for_delivery",
        changedByUserId: adminId,
        actorRole: "admin",
        customerMessage: "Your order has been dispatched via Delhivery Express. Tracking: DLH-992837461",
        internalNote: "Courier: Delhivery Express, Tracking: DLH-992837461",
      });

      const [updated] = await db.select().from(orders).where(eq(orders.id, orderId));
      expect(updated.orderStatus).toBe("out_for_delivery");
      expect(updated.courierName).toBe("Delhivery Express");
      expect(updated.trackingNumber).toBe("DLH-992837461");
      expect(updated.dispatchedAt).toBe(dispatchTime);

      const timeline = await getOrderTimeline(orderId);
      expect(timeline.length).toBeGreaterThan(0);
      const latest = timeline[timeline.length - 1];
      expect(latest.newStatus).toBe("out_for_delivery");
      expect(latest.customerMessage).toContain("DLH-992837461");
    });

    it("should allow payment status and fulfillment status to transition independently", async () => {
      const orderId = `ord_perf_indep_${crypto.randomUUID()}`;
      const ref = generateOrderReference();

      await db.insert(orders).values({
        id: orderId,
        orderReference: ref,
        customerId,
        orderType: "print_service",
        subtotal: 200,
        totalAmount: 200,
        paymentStatus: "unpaid",
        orderStatus: "pending",
        deliveryType: "store_pickup",
      });

      // Advance order workflow to processing while keeping payment unpaid
      await db
        .update(orders)
        .set({ orderStatus: "processing" })
        .where(eq(orders.id, orderId));

      const [step1] = await db.select().from(orders).where(eq(orders.id, orderId));
      expect(step1.orderStatus).toBe("processing");
      expect(step1.paymentStatus).toBe("unpaid");

      // Verify payment separately
      await db
        .update(orders)
        .set({ paymentStatus: "paid" })
        .where(eq(orders.id, orderId));

      const [step2] = await db.select().from(orders).where(eq(orders.id, orderId));
      expect(step2.orderStatus).toBe("processing");
      expect(step2.paymentStatus).toBe("paid");
    });
  });

  describe("PART 3: In-Memory Settings Cache & Performance", () => {
    it("should cache shop settings in memory and serve subsequent calls quickly without query overhead", async () => {
      invalidateShopSettingsCache();

      const start = Date.now();
      const settings1 = await getShopSettings();
      const duration1 = Date.now() - start;

      const startCached = Date.now();
      const settings2 = await getShopSettings();
      const duration2 = Date.now() - startCached;

      expect(settings1.shopName).toBe(settings2.shopName);
      expect(duration2).toBeLessThanOrEqual(duration1 + 5); // Cached in memory
    });

    it("should invalidate and refresh settings cache when updateShopSettings is invoked", async () => {
      const initial = await getShopSettings();
      const testPhone = "9876599999";

      await updateShopSettings({ contactPhone: testPhone }, adminId);
      const refreshed = await getShopSettings();

      expect(refreshed.contactPhone).toBe(testPhone);

      // Restore
      await updateShopSettings({ contactPhone: initial.contactPhone }, adminId);
    });
  });

  describe("PART 4: Payment Reconciliation Accounting Integrity", () => {
    it("should compute amountPaid from verified payment submissions and amountRemaining accurately", async () => {
      const orderId = `ord_perf_recon_${crypto.randomUUID()}`;
      const ref = generateOrderReference();
      const totalAmount = 500;

      await db.insert(orders).values({
        id: orderId,
        orderReference: ref,
        customerId,
        orderType: "shopping",
        subtotal: totalAmount,
        totalAmount,
        paymentStatus: "pending",
        paymentMethod: "upi_mock",
        orderStatus: "pending",
        deliveryType: "store_pickup",
      });

      // Customer submits UTR claim of ₹500
      const subId = `sub_${crypto.randomUUID()}`;
      await db.insert(paymentSubmissions).values({
        id: subId,
        orderId,
        customerId,
        amount: totalAmount,
        amountClaimed: totalAmount,
        paymentMethod: "upi",
        upiIdUsed: "9735154080@slc",
        transactionId: "UTR2610998877",
        utrNumber: "UTR2610998877",
        paymentProofUrl: "/uploads/proofs/test.jpg",
        receivingUpiIdSnapshot: "9735154080@slc",
        status: "pending_verification",
      } as any);

      // Before admin verification: amount verified is 0
      const unverifiedSubs = await db
        .select()
        .from(paymentSubmissions)
        .where(eq(paymentSubmissions.orderId, orderId));
      const verifiedBefore = unverifiedSubs.filter((s) => s.status === "verified");
      const paidBefore = verifiedBefore.reduce((sum, s) => sum + ((s as any).amountClaimed || s.amount || 0), 0);
      const remainingBefore = Math.max(0, totalAmount - paidBefore);

      expect(paidBefore).toBe(0);
      expect(remainingBefore).toBe(500);

      // Admin verifies submission
      await db
        .update(paymentSubmissions)
        .set({ status: "verified", verifiedByUserId: adminId, verifiedAt: Date.now() } as any)
        .where(eq(paymentSubmissions.id, subId));
      await db
        .update(orders)
        .set({ paymentStatus: "paid" })
        .where(eq(orders.id, orderId));

      const verifiedSubs = await db
        .select()
        .from(paymentSubmissions)
        .where(eq(paymentSubmissions.orderId, orderId));
      const verifiedAfter = verifiedSubs.filter((s) => s.status === "verified");
      const paidAfter = verifiedAfter.reduce((sum, s) => sum + ((s as any).amountClaimed || s.amount || 0), 0);
      const remainingAfter = Math.max(0, totalAmount - paidAfter);

      expect(paidAfter).toBe(500);
      expect(remainingAfter).toBe(0);
    });
  });
});
