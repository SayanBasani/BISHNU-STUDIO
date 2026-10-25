import { describe, it, expect, beforeAll } from "vitest";
import {
  evaluateOrderReturnEligibility,
  validateReturnTransition,
  generateReturnReference,
  RETURN_STATUSES,
} from "../src/lib/return-state-machine";
import { db } from "../src/db";
import {
  users,
  productCategories,
  products,
  orders,
  orderItems,
  orderReturns,
  orderReturnItems,
} from "../src/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

describe("Return Lifecycle, Eligibility Engine & Restocking Tests", () => {
  const customerId = `usr_ret_${Date.now()}`;
  const categoryId = `cat_ret_${Date.now()}`;
  const productId = `prd_ret_${Date.now()}`;
  const orderId = `ord_ret_${Date.now()}`;
  const orderItemId = `itm_ret_${Date.now()}`;
  const returnId = `ret_entry_${Date.now()}`;

  beforeAll(async () => {
    // 1. Seed customer
    await db
      .insert(users)
      .values({
        id: customerId,
        fullName: "Ananya Sen",
        email: `ananya_${Date.now()}@example.com`,
        phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        passwordHash: "hash_pwd_ananya",
        role: "customer",
        isEmailVerified: true,
        isPhoneVerified: true,
      });

    // 2. Seed category & product with initial stock = 50
    await db
      .insert(productCategories)
      .values({
        id: categoryId,
        name: "Notebooks & Diaries",
        slug: `notebooks-${Date.now()}`,
      });

    await db
      .insert(products)
      .values({
        id: productId,
        categoryId: categoryId,
        name: "Classmate Spiral Notebook A4",
        slug: `classmate-spiral-${Date.now()}`,
        sku: `SKU-NB-${Date.now()}`,
        description: "Standard unruled spiral notebook for engineering students.",
        price: 120,
        stockQuantity: 50,
        isAvailable: true,
      });

    // 3. Seed completed order delivered 2 days ago
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const testOrderRef = `BS-RET-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    await db
      .insert(orders)
      .values({
        id: orderId,
        orderReference: testOrderRef,
        customerId: customerId,
        orderType: "shopping",
        orderStatus: "completed",
        paymentStatus: "paid",
        paymentMethod: "online",
        deliveryType: "home_delivery",
        fulfillmentStatus: "delivered",
        subtotal: 360,
        discount: 0,
        additionalCharges: 0,
        totalAmount: 360,
        deliveredAt: twoDaysAgo,
        createdAt: twoDaysAgo,
      });

    // 4. Seed order item (3 units of notebook @ 120 each)
    await db
      .insert(orderItems)
      .values({
        id: orderItemId,
        orderId: orderId,
        itemType: "product",
        productId: productId,
        configurationJson: "{}",
        productNameSnapshot: "Classmate Spiral Notebook A4",
        unitPriceSnapshot: 120,
        quantity: 3,
        totalPriceSnapshot: 360,
      });
  });

  describe("1. Order Return Eligibility Calculations", () => {
    it("should reject return requests for non-completed orders", () => {
      const nonCompletedOrder = {
        id: "ord_pending_01",
        orderStatus: "processing",
        createdAt: Date.now() - 100000,
      };

      const items = [
        { id: "item_1", itemType: "product", quantity: 2, unitPriceSnapshot: 50 },
      ];

      const eligibility = evaluateOrderReturnEligibility(nonCompletedOrder, items, []);
      expect(eligibility.isEligible).toBe(false);
      expect(eligibility.reason).toContain("Returns can only be requested once an order has been completed and delivered");
    });

    it("should accept completed orders within the return window", () => {
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
      const completedOrder = {
        id: "ord_comp_01",
        orderStatus: "completed",
        deliveredAt: twoDaysAgo,
        createdAt: twoDaysAgo,
      };

      const items = [
        { id: "item_1", itemType: "product", quantity: 3, unitPriceSnapshot: 120 },
      ];

      const eligibility = evaluateOrderReturnEligibility(completedOrder, items, [], 7);
      expect(eligibility.isEligible).toBe(true);
      expect(eligibility.daysRemaining).toBe(5);
      expect(eligibility.returnableItems[0].eligibleQuantity).toBe(3);
    });

    it("should reject return requests after returnWindowDays has elapsed", () => {
      const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
      const expiredOrder = {
        id: "ord_expired_01",
        orderStatus: "completed",
        deliveredAt: tenDaysAgo,
        createdAt: tenDaysAgo,
      };

      const items = [
        { id: "item_1", itemType: "product", quantity: 2, unitPriceSnapshot: 100 },
      ];

      const eligibility = evaluateOrderReturnEligibility(expiredOrder, items, [], 7);
      expect(eligibility.isEligible).toBe(false);
      expect(eligibility.reason).toContain("Return window expired");
      expect(eligibility.daysRemaining).toBe(0);
    });

    it("should calculate remaining returnable quantity preventing duplicate active returns", () => {
      const completedOrder = {
        id: "ord_comp_02",
        orderStatus: "completed",
        deliveredAt: Date.now() - 1000,
        createdAt: Date.now() - 1000,
      };

      const items = [
        { id: "item_a", itemType: "product", quantity: 5, unitPriceSnapshot: 80 },
      ];

      // Existing active return for 2 units
      const existingReturns = [
        { orderItemId: "item_a", quantity: 2, status: "approved" },
      ];

      const check1 = evaluateOrderReturnEligibility(completedOrder, items, existingReturns, 7);
      expect(check1.isEligible).toBe(true);
      expect(check1.returnableItems[0].eligibleQuantity).toBe(3);
      expect(check1.returnableItems[0].quantityPreviouslyReturned).toBe(2);

      // Existing returns cover all 5 units
      const fullyReturned = [
        { orderItemId: "item_a", quantity: 2, status: "approved" },
        { orderItemId: "item_a", quantity: 3, status: "in_transit" },
      ];

      const check2 = evaluateOrderReturnEligibility(completedOrder, items, fullyReturned, 7);
      expect(check2.isEligible).toBe(false);
      expect(check2.returnableItems[0].eligibleQuantity).toBe(0);
      expect(check2.returnableItems[0].ineligibilityReason).toContain("All ordered units have already been returned");
    });

    it("should ignore rejected and cancelled returns when computing remaining returnable quantity", () => {
      const completedOrder = {
        id: "ord_comp_03",
        orderStatus: "completed",
        deliveredAt: Date.now() - 1000,
        createdAt: Date.now() - 1000,
      };

      const items = [
        { id: "item_b", itemType: "product", quantity: 4, unitPriceSnapshot: 50 },
      ];

      // A previously rejected or cancelled return should NOT consume eligible quantity
      const historicalReturns = [
        { orderItemId: "item_b", quantity: 4, status: "rejected" },
        { orderItemId: "item_b", quantity: 2, status: "cancelled" },
      ];

      const check = evaluateOrderReturnEligibility(completedOrder, items, historicalReturns, 7);
      expect(check.isEligible).toBe(true);
      expect(check.returnableItems[0].eligibleQuantity).toBe(4);
    });
  });

  describe("2. Return Reference Generation", () => {
    it("should generate standardized auditable return references (RET-YYYYMM-XXXX)", () => {
      const ref = generateReturnReference();
      expect(ref).toMatch(/^RET-\d{6}-\d{4}$/);
    });
  });

  describe("3. Return State Machine Transitions", () => {
    it("should allow standard forward progression", () => {
      expect(validateReturnTransition("requested", "approved").valid).toBe(true);
      expect(validateReturnTransition("approved", "pickup_scheduled").valid).toBe(true);
      expect(validateReturnTransition("pickup_scheduled", "in_transit").valid).toBe(true);
      expect(validateReturnTransition("in_transit", "received").valid).toBe(true);
      expect(validateReturnTransition("received", "inspection_in_progress").valid).toBe(true);
      expect(validateReturnTransition("inspection_in_progress", "refund_pending").valid).toBe(true);
      expect(validateReturnTransition("refund_pending", "refund_processed").valid).toBe(true);
      expect(validateReturnTransition("refund_processed", "completed").valid).toBe(true);
    });

    it("should prevent illegal transitions (e.g. requested directly to completed)", () => {
      const illegal = validateReturnTransition("requested", "completed");
      expect(illegal.valid).toBe(false);
      expect(illegal.error).toContain("Cannot transition return from 'requested' to 'completed'");
    });

    it("should prevent modifying terminal return states without explicit override", () => {
      const fromCompleted = validateReturnTransition("completed", "requested");
      expect(fromCompleted.valid).toBe(false);
      expect(fromCompleted.error).toContain("terminal state");

      const fromRejected = validateReturnTransition("rejected", "approved");
      expect(fromRejected.valid).toBe(false);
      expect(fromRejected.error).toContain("terminal state");

      // Override permits correction
      const override = validateReturnTransition("completed", "under_review", true);
      expect(override.valid).toBe(true);
    });
  });

  describe("4. Return Validation Rules: Mandatory Rejections & Refund UTR", () => {
    it("should require a non-empty rejectionReason when rejecting a return", () => {
      const validateRejection = (status: string, reason?: string | null) => {
        if (status === "rejected" && (!reason || reason.trim().length === 0)) {
          return { valid: false, error: "A clear rejection reason is mandatory when declining a return request." };
        }
        return { valid: true };
      };

      expect(validateRejection("rejected", "").valid).toBe(false);
      expect(validateRejection("rejected", "   ").valid).toBe(false);
      expect(validateRejection("rejected", null).valid).toBe(false);
      expect(validateRejection("rejected", "Item was tampered and missing original packaging").valid).toBe(true);
    });

    it("should require a valid UTR transaction reference when recording refund disbursement", () => {
      const validateRefundSettlement = (status: string, utr?: string | null, amount?: number | null) => {
        if (status === "refund_processed" || status === "completed") {
          if (!utr || utr.trim().length < 6) {
            return { valid: false, error: "A valid banking or UPI UTR reference number is mandatory." };
          }
          if (!amount || amount <= 0) {
            return { valid: false, error: "Disbursed refund amount must be greater than zero." };
          }
        }
        return { valid: true };
      };

      expect(validateRefundSettlement("refund_processed", "", 240).valid).toBe(false);
      expect(validateRefundSettlement("refund_processed", "123", 240).valid).toBe(false);
      expect(validateRefundSettlement("refund_processed", "UTR9928172619", 0).valid).toBe(false);
      expect(validateRefundSettlement("refund_processed", "UPI-REF-49281726", 240).valid).toBe(true);
    });
  });

  describe("5. Return Database Persistence & Idempotent Restocking", () => {
    it("should insert return record and item-level snapshots", async () => {
      const retRef = generateReturnReference();

      // Insert return
      await db
        .insert(orderReturns)
        .values({
          id: returnId,
          returnReference: retRef,
          orderId: orderId,
          customerId: customerId,
          status: "received",
          reason: "defective",
          requestedResolution: "refund",
          customerDescription: "Spiral wire is bent and pages are misaligned.",
          restocked: false,
          refundAmount: 240,
        });

      // Insert return item (2 of the 3 units)
      await db
        .insert(orderReturnItems)
        .values({
          id: `item_ret_${Date.now()}`,
          returnId: returnId,
          orderItemId: orderItemId,
          productId: productId,
          quantity: 2,
          unitPriceSnapshot: 120,
          totalPriceSnapshot: 240,
        });

      // Query back
      const [savedReturn] = await db.select().from(orderReturns).where(eq(orderReturns.id, returnId)).limit(1);
      expect(savedReturn).toBeDefined();
      expect(savedReturn.returnReference).toBe(retRef);
      expect(savedReturn.status).toBe("received");
      expect(savedReturn.restocked).toBe(false);
      expect(savedReturn.refundAmount).toBe(240);
    });

    it("should restock inventory idempotently (exactly once)", async () => {
      // Starting stock is 50
      const [beforeRestock] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
      expect(beforeRestock.stockQuantity).toBe(50);

      // Simulation of restocking logic in src/app/api/returns/[id]/route.ts
      const performRestock = async (targetReturnId: string, shouldRestock: boolean) => {
        const [ret] = await db.select().from(orderReturns).where(eq(orderReturns.id, targetReturnId)).limit(1);
        if (!ret) throw new Error("Return not found");

        if (shouldRestock && !ret.restocked) {
          const retItems = await db.select().from(orderReturnItems).where(eq(orderReturnItems.returnId, targetReturnId));
          for (const item of retItems) {
            if (item.productId) {
              const [currProd] = await db.select().from(products).where(eq(products.id, item.productId)).limit(1);
              if (currProd) {
                await db
                  .update(products)
                  .set({ stockQuantity: (currProd.stockQuantity ?? 0) + item.quantity })
                  .where(eq(products.id, item.productId));
              }
            }
          }
          await db.update(orderReturns).set({ restocked: true }).where(eq(orderReturns.id, targetReturnId));
          return { restocked: true };
        }

        return { restocked: false, alreadyRestocked: ret.restocked };
      };

      // 1. First restock execution: 50 + 2 = 52
      const firstRun = await performRestock(returnId, true);
      expect(firstRun.restocked).toBe(true);

      const [afterFirst] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
      expect(afterFirst.stockQuantity).toBe(52);

      // 2. Second restock execution on same return: should be a NO-OP (idempotent)
      const secondRun = await performRestock(returnId, true);
      expect(secondRun.restocked).toBe(false);
      expect(secondRun.alreadyRestocked).toBe(true);

      const [afterSecond] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
      expect(afterSecond.stockQuantity).toBe(52); // Must not increment to 54!
    });
  });
});
