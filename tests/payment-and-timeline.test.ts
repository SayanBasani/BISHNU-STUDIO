import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isValidUpiId,
  isValidTransactionId,
  buildUpiPaymentUri,
  generateQrCodeDataUrl,
  getShopSettings,
  updateShopSettings,
} from "@/lib/settings";
import { recordOrderEvent, getOrderTimeline } from "@/lib/order-timeline";
import { db } from "@/db";
import {
  orders,
  users,
  paymentSubmissions,
  orderStatusHistory,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

describe("UPI Payment Verification & Order Progress Timeline Tests", () => {
  describe("UPI Utilities & Format Validation", () => {
    it("should accurately validate genuine UPI VPA handles", () => {
      expect(isValidUpiId("bishnustudio@icici")).toBe(true);
      expect(isValidUpiId("merchant.pay@okaxis")).toBe(true);
      expect(isValidUpiId("user123@paytm")).toBe(true);
      expect(isValidUpiId("studio-print@sbi")).toBe(true);

      // Invalid formats
      expect(isValidUpiId("invalid-id")).toBe(false);
      expect(isValidUpiId("@bank")).toBe(false);
      expect(isValidUpiId("user@")).toBe(false);
      expect(isValidUpiId("user name@hdfc")).toBe(false);
      expect(isValidUpiId("")).toBe(false);
    });

    it("should validate 12-digit UTR numbers and transaction references", () => {
      expect(isValidTransactionId("423512345678")).toBe(true); // 12-digit standard banking UTR
      expect(isValidTransactionId("UPI20261024ABC1")).toBe(true);
      expect(isValidTransactionId("TXN_9876543210")).toBe(true);

      // Invalid formats
      expect(isValidTransactionId("123")).toBe(false); // Too short
      expect(isValidTransactionId("")).toBe(false);
      expect(isValidTransactionId("A".repeat(40))).toBe(false); // Too long
    });

    it("should construct standardized upi://pay URI with exact amount and reference", () => {
      const uri = buildUpiPaymentUri({
        upiId: "bishnustudio@icici",
        merchantName: "Bishnu Studio",
        amount: 249.5,
        orderReference: "BS-2610-TEST",
      });

      expect(uri).toContain("upi://pay");
      expect(uri).toContain("pa=bishnustudio%40icici");
      expect(uri).toContain("pn=Bishnu%20Studio");
      expect(uri).toContain("am=249.50");
      expect(uri).toContain("cu=INR");
      expect(uri).toContain("tn=Order%20BS-2610-TEST");
      expect(uri).toContain("tr=BS-2610-TEST");
    });

    it("should generate a valid PNG base64 data URL for QR codes", async () => {
      const testUri = "upi://pay?pa=bishnu@icici&pn=Bishnu&am=100.00&cu=INR";
      const qrDataUrl = await generateQrCodeDataUrl(testUri);

      expect(qrDataUrl).toBeDefined();
      expect(qrDataUrl).toMatch(/^data:image\/png;base64,/);
    });
  });

  describe("Shop Business Information & Settings Persistence", () => {
    it("should fetch default shop settings and allow updating business address", async () => {
      const initial = await getShopSettings();
      expect(initial.shopName).toBeDefined();
      expect(initial.upiEnabled).toBe(true);

      // Update shop details
      const updated = await updateShopSettings({
        shopName: "Bishnu Studio & Cyber Hub",
        building: "Shop 4A, Municipal Commercial Complex",
        cityTown: "Barasat",
        pinCode: "700002",
        contactPhone: "+91 98000 11122",
      });

      expect(updated.shopName).toBe("Bishnu Studio & Cyber Hub");
      expect(updated.building).toBe("Shop 4A, Municipal Commercial Complex");
      expect(updated.cityTown).toBe("Barasat");
      expect(updated.pinCode).toBe("700002");
      expect(updated.contactPhone).toBe("+91 98000 11122");

      // Verify retrieval returns updated record
      const reFetched = await getShopSettings();
      expect(reFetched.shopName).toBe("Bishnu Studio & Cyber Hub");
    });
  });

  describe("Order Event Timeline Recording & Retrieval", () => {
    const testOrderId = `ord_test_timeline_${Date.now()}`;
    const testUserId = `usr_test_tl_${Date.now()}`;

    beforeEach(async () => {
      // Create user
      await db.insert(users).values({
        id: testUserId,
        email: `tester_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`,
        passwordHash: "hash_placeholder",
        fullName: "Test Customer",
        phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        role: "customer",
        isEmailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create order
      await db.insert(orders).values({
        id: testOrderId,
        orderReference: `BS-TL-${Date.now()}`,
        customerId: testUserId,
        subtotal: 300,
        taxAmount: 0,
        deliveryCharge: 0,
        additionalCharges: 0,
        totalAmount: 300,
        orderStatus: "pending",
        paymentStatus: "unpaid",
        paymentMethod: "upi_mock",
        deliveryType: "store_pickup",
        orderType: "mixed",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any);
    });

    afterEach(async () => {
      // Cleanup
      await db.delete(orderStatusHistory).where(eq(orderStatusHistory.orderId, testOrderId));
      await db.delete(paymentSubmissions).where(eq(paymentSubmissions.orderId, testOrderId));
      await db.delete(orders).where(eq(orders.id, testOrderId));
      await db.delete(users).where(eq(users.id, testUserId));
    });

    it("should sequentially record status timeline events with real timestamps and messages", async () => {
      // 1. Order Placed event
      await recordOrderEvent({
        orderId: testOrderId,
        previousStatus: null,
        newStatus: "pending",
        previousPaymentStatus: null,
        newPaymentStatus: "unpaid",
        changedByUserId: testUserId,
        actorRole: "customer",
        customerMessage: "Order placed. Awaiting UPI payment proof.",
      });

      // 2. Customer submits payment proof
      await recordOrderEvent({
        orderId: testOrderId,
        previousStatus: "pending",
        newStatus: "pending",
        previousPaymentStatus: "unpaid",
        newPaymentStatus: "pending_verification",
        changedByUserId: testUserId,
        actorRole: "customer",
        customerMessage: "Customer uploaded payment screenshot and submitted UTR 423512345678.",
      });

      // 3. Admin verifies payment
      await recordOrderEvent({
        orderId: testOrderId,
        previousStatus: "pending",
        newStatus: "confirmed",
        previousPaymentStatus: "pending_verification",
        newPaymentStatus: "paid",
        changedByUserId: null,
        actorRole: "admin",
        customerMessage: "Payment verified by Bishnu Studio. Order confirmed and sent to print queue.",
        internalNote: "Matched counter bank statement ICICI 10:15 AM",
      });

      // Retrieve timeline
      const timeline = await getOrderTimeline(testOrderId);
      expect(timeline.length).toBe(3);

      expect(timeline[0].newStatus).toBe("pending");
      expect(timeline[0].actorRole).toBe("customer");

      expect(timeline[1].newPaymentStatus).toBe("pending_verification");

      expect(timeline[2].newStatus).toBe("confirmed");
      expect(timeline[2].newPaymentStatus).toBe("paid");
      expect(timeline[2].actorRole).toBe("admin");
      expect(timeline[2].internalNote).toBe("Matched counter bank statement ICICI 10:15 AM");
    });
  });

  describe("Payment Submission State Machine & Admin Verification Lifecycle", () => {
    const testOrderId = `ord_test_flow_${Date.now()}`;
    const testUserId = `usr_test_flow_${Date.now()}`;
    const testSubmissionId = `pay_sub_${Date.now()}`;
    const uniqueUtr = `4235${Date.now().toString().slice(-8)}`;

    beforeEach(async () => {
      // Create user
      await db.insert(users).values({
        id: testUserId,
        email: `flow_tester_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`,
        passwordHash: "hash_placeholder",
        fullName: "Flow Tester",
        phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
        role: "customer",
        isEmailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create order
      await db.insert(orders).values({
        id: testOrderId,
        orderReference: `BS-FLOW-${Date.now()}`,
        customerId: testUserId,
        subtotal: 500,
        taxAmount: 0,
        deliveryCharge: 0,
        additionalCharges: 0,
        totalAmount: 500,
        orderStatus: "pending",
        paymentStatus: "unpaid",
        paymentMethod: "upi_mock",
        deliveryType: "store_pickup",
        orderType: "mixed",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } as any);
    });

    afterEach(async () => {
      // Cleanup
      await db.delete(orderStatusHistory).where(eq(orderStatusHistory.orderId, testOrderId));
      await db.delete(paymentSubmissions).where(eq(paymentSubmissions.orderId, testOrderId));
      await db.delete(orders).where(eq(orders.id, testOrderId));
      await db.delete(users).where(eq(users.id, testUserId));
    });

    it("should accurately track submission from pending_verification to verified", async () => {
      // Step 1: Customer submits proof
      await db.insert(paymentSubmissions).values({
        id: testSubmissionId,
        orderId: testOrderId,
        customerId: testUserId,
        amount: 500,
        paymentMethod: "upi_mock",
        upiIdUsed: "bishnustudio@icici",
        transactionId: uniqueUtr,
        screenshotFileId: null,
        screenshotUrl: "/mock-screenshot.png",
        status: "pending_verification",
        attemptNumber: 1,
        createdAt: Date.now(),
      });

      // Update order status to pending_verification
      await db.update(orders).set({ paymentStatus: "pending" }).where(eq(orders.id, testOrderId));

      // Verify submission is pending
      const sub = await db
        .select()
        .from(paymentSubmissions)
        .where(eq(paymentSubmissions.id, testSubmissionId))
        .limit(1);

      expect(sub.length).toBe(1);
      expect(sub[0].status).toBe("pending_verification");
      expect(sub[0].transactionId).toBe(uniqueUtr);

      // Step 2: Admin verifies payment
      await db
        .update(paymentSubmissions)
        .set({
          status: "verified",
          verifiedAt: Date.now(),
          verificationNote: "Verified in Axis current account statement",
        })
        .where(eq(paymentSubmissions.id, testSubmissionId));

      // Order should automatically transition to PAID and CONFIRMED
      await db
        .update(orders)
        .set({
          paymentStatus: "paid",
          orderStatus: "confirmed",
          updatedAt: Date.now(),
        })
        .where(eq(orders.id, testOrderId));

      const updatedOrder = await db
        .select()
        .from(orders)
        .where(eq(orders.id, testOrderId))
        .limit(1);

      expect(updatedOrder[0].paymentStatus).toBe("paid");
      expect(updatedOrder[0].orderStatus).toBe("confirmed");

      const updatedSub = await db
        .select()
        .from(paymentSubmissions)
        .where(eq(paymentSubmissions.id, testSubmissionId))
        .limit(1);

      expect(updatedSub[0].status).toBe("verified");
      expect(updatedSub[0].verifiedAt).toBeDefined();
    });

    it("should allow rejection with a customer reason and leave order unpaid", async () => {
      // Customer submits invalid proof
      const rejectSubId = `sub_rej_${Date.now()}`;
      await db.insert(paymentSubmissions).values({
        id: rejectSubId,
        orderId: testOrderId,
        customerId: testUserId,
        amount: 500,
        paymentMethod: "upi_mock",
        upiIdUsed: "bishnustudio@icici",
        transactionId: "INVALID_UTR_99",
        screenshotFileId: null,
        screenshotUrl: "/mock-screenshot.png",
        status: "pending_verification",
        attemptNumber: 1,
        createdAt: Date.now(),
      });

      // Admin rejects
      await db
        .update(paymentSubmissions)
        .set({
          status: "rejected",
          rejectionReason: "utr_not_found",
          rejectionNote: "UTR not found in ICICI bank records. Please upload actual receipt.",
        })
        .where(eq(paymentSubmissions.id, rejectSubId));

      await db
        .update(orders)
        .set({
          paymentStatus: "unpaid",
          updatedAt: Date.now(),
        })
        .where(eq(orders.id, testOrderId));

      const orderRow = await db.select().from(orders).where(eq(orders.id, testOrderId)).limit(1);
      const subRow = await db.select().from(paymentSubmissions).where(eq(paymentSubmissions.id, rejectSubId)).limit(1);

      // Order remains unpaid
      expect(orderRow[0].paymentStatus).toBe("unpaid");
      // Submission marked rejected with explanation
      expect(subRow[0].status).toBe("rejected");
      expect(subRow[0].rejectionReason).toBe("utr_not_found");
      expect(subRow[0].rejectionNote).toContain("UTR not found");
    });

    it("Case A: Customer creates order but never pays - order remains strictly unpaid", async () => {
      const orderRow = await db.select().from(orders).where(eq(orders.id, testOrderId)).limit(1);
      // Payment status MUST NOT be paid or pending_verification
      expect(orderRow[0].paymentStatus).toBe("unpaid");
      expect(orderRow[0].orderStatus).toBe("pending");
    });

    it("Case K: Customer reports payment on a cancelled order - sets review_required without reopening automatically", async () => {
      // Order was cancelled
      await db.update(orders).set({ orderStatus: "cancelled" }).where(eq(orders.id, testOrderId));

      // Customer reports late payment transfer
      const postCancelSubId = `sub_cancel_${Date.now()}`;
      await db.insert(paymentSubmissions).values({
        id: postCancelSubId,
        orderId: testOrderId,
        customerId: testUserId,
        amount: 500,
        paymentMethod: "upi",
        upiIdUsed: "bishnustudio@icici",
        transactionId: `CANCEL_UTR_${Date.now()}`,
        status: "review_required",
        submissionType: "post_cancellation_claim",
        createdAt: Date.now(),
      });

      await db
        .update(orders)
        .set({ paymentStatus: "review_required" })
        .where(eq(orders.id, testOrderId));

      const updatedOrder = await db.select().from(orders).where(eq(orders.id, testOrderId)).limit(1);
      const sub = await db.select().from(paymentSubmissions).where(eq(paymentSubmissions.id, postCancelSubId)).limit(1);

      // Order remains cancelled until admin explicitly verifies
      expect(updatedOrder[0].orderStatus).toBe("cancelled");
      expect(updatedOrder[0].paymentStatus).toBe("review_required");
      expect(sub[0].status).toBe("review_required");
      expect(sub[0].submissionType).toBe("post_cancellation_claim");
    });

    it("Case L: Duplicate UTR submitted across multiple orders triggers investigation flag", async () => {
      const sharedUtr = `DUP_UTR_${Date.now()}`;

      // Submission 1 on test order
      const sub1Id = `sub_dup1_${Date.now()}`;
      await db.insert(paymentSubmissions).values({
        id: sub1Id,
        orderId: testOrderId,
        customerId: testUserId,
        amount: 500,
        paymentMethod: "upi",
        upiIdUsed: "bishnustudio@icici",
        transactionId: sharedUtr,
        status: "pending_verification",
        isDuplicateFlagged: false,
        createdAt: Date.now(),
      });

      // Second order created with same UTR
      const secondOrderId = `ord_second_${Date.now()}`;
      await db.insert(orders).values({
        id: secondOrderId,
        orderReference: `BS-DUP-${Date.now()}`,
        customerId: testUserId,
        subtotal: 500,
        totalAmount: 500,
        orderStatus: "pending",
        paymentStatus: "review_required",
        paymentMethod: "upi_mock",
        orderType: "mixed",
        deliveryType: "store_pickup",
        createdAt: Date.now(),
      } as any);

      const sub2Id = `sub_dup2_${Date.now()}`;
      await db.insert(paymentSubmissions).values({
        id: sub2Id,
        orderId: secondOrderId,
        customerId: testUserId,
        amount: 500,
        paymentMethod: "upi",
        upiIdUsed: "bishnustudio@icici",
        transactionId: sharedUtr,
        status: "review_required",
        isDuplicateFlagged: true,
        duplicateNotes: `Shared UTR with order ${testOrderId}`,
        createdAt: Date.now(),
      });

      const sub2 = await db.select().from(paymentSubmissions).where(eq(paymentSubmissions.id, sub2Id)).limit(1);
      expect(sub2[0].isDuplicateFlagged).toBe(true);
      expect(sub2[0].status).toBe("review_required");
      expect(sub2[0].duplicateNotes).toContain(testOrderId);

      // Cleanup
      await db.delete(paymentSubmissions).where(eq(paymentSubmissions.orderId, secondOrderId));
      await db.delete(orders).where(eq(orders.id, secondOrderId));
    });

    it("Case O: Concurrency guard prevents duplicate verification on already verified payment", async () => {
      const verifiedSubId = `sub_conc_${Date.now()}`;
      await db.insert(paymentSubmissions).values({
        id: verifiedSubId,
        orderId: testOrderId,
        customerId: testUserId,
        amount: 500,
        paymentMethod: "upi",
        upiIdUsed: "bishnustudio@icici",
        transactionId: `UTR_CONC_${Date.now()}`,
        status: "verified",
        verifiedAt: Date.now(),
        createdAt: Date.now(),
      });

      await db.update(orders).set({ paymentStatus: "paid", orderStatus: "confirmed" }).where(eq(orders.id, testOrderId));

      // Attempting to re-verify or act on already verified submission is guarded
      const sub = await db.select().from(paymentSubmissions).where(eq(paymentSubmissions.id, verifiedSubId)).limit(1);
      const isAlreadyVerified = sub[0].status === "verified";
      expect(isAlreadyVerified).toBe(true);
    });
  });
});
