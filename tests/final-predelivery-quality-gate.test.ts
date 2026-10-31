import { describe, it, expect } from "vitest";
import {
  PHYSICAL_RETURN_STATUSES,
  REFUND_STATUSES,
  VALID_RETURN_TRANSITIONS,
  VALID_REFUND_TRANSITIONS,
  validateReturnTransition,
  validateRefundTransition,
  maskDestinationDetails,
} from "../src/lib/return-state-machine";
import fs from "fs";
import path from "path";

describe("BS-FINAL-02: Category Source of Truth & Modal Visibility", () => {
  const adminProductPageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/admin/products/page.tsx"),
    "utf-8"
  );
  const adminProductPutRouteSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/admin/products/[id]/route.ts"),
    "utf-8"
  );
  const publicProductsRouteSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/products/route.ts"),
    "utf-8"
  );

  it("should permit categoryId in product update schema", () => {
    expect(adminProductPutRouteSource).toContain("categoryId: z.string().min(1).optional()");
    expect(adminProductPutRouteSource).toContain("productCategories");
  });

  it("should render category selector in both create and edit modals", () => {
    // Verifies that category selection is not conditionally hidden behind !editingProduct
    expect(adminProductPageSource).not.toContain("{!editingProduct && (\n                <div>\n                  <label className=\"block font-semibold text-slate-700 dark:text-slate-300 mb-1\">\n                    Category");
    expect(adminProductPageSource).toContain("fetch(\"/api/admin/categories\", { cache: \"no-store\" })");
  });

  it("should use leftJoin in products API to avoid dropping products with missing categories", () => {
    expect(publicProductsRouteSource).toContain(".leftJoin(productCategories, eq(products.categoryId, productCategories.id))");
    expect(publicProductsRouteSource).toContain('headers["Cache-Control"] = "no-store"');
  });
});

describe("BS-FINAL-02: Financial Accuracy & INR Invariance", () => {
  const paymentProofRouteSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/orders/[id]/payment/route.ts"),
    "utf-8"
  );

  it("should format payment proof notification in canonical INR without dividing by 100", () => {
    expect(paymentProofRouteSource).not.toContain("order.totalAmount / 100");
    expect(paymentProofRouteSource).toContain("order.totalAmount.toFixed(2)");
  });
});

describe("BS-FINAL-02: Physical Return & Refund Settlement State Machines", () => {
  it("should define separate physical return and refund settlement statuses", () => {
    expect(PHYSICAL_RETURN_STATUSES).toContain("requested");
    expect(PHYSICAL_RETURN_STATUSES).toContain("pickup_scheduled");
    expect(PHYSICAL_RETURN_STATUSES).toContain("picked_up");
    expect(PHYSICAL_RETURN_STATUSES).toContain("counter_dropoff");
    expect(PHYSICAL_RETURN_STATUSES).toContain("received_at_studio");
    expect(PHYSICAL_RETURN_STATUSES).toContain("inspection_passed");
    expect(PHYSICAL_RETURN_STATUSES).toContain("return_completed");

    expect(REFUND_STATUSES).toContain("pending_review");
    expect(REFUND_STATUSES).toContain("approved");
    expect(REFUND_STATUSES).toContain("pending_payout");
    expect(REFUND_STATUSES).toContain("payout_initiated");
    expect(REFUND_STATUSES).toContain("paid");
    expect(REFUND_STATUSES).toContain("disputed");
  });

  it("should enforce valid physical return transitions and reject out-of-order jumps", () => {
    // Requested cannot jump directly to picked_up
    const jumpCheck = validateReturnTransition("requested", "picked_up");
    expect(jumpCheck.valid).toBe(false);
    expect(jumpCheck.error).toContain("Cannot transition return from 'requested' to 'picked up'");

    // Approved can transition to pickup_scheduled or picked_up or counter_dropoff
    const validPickup = validateReturnTransition("approved", "pickup_scheduled");
    expect(validPickup.valid).toBe(true);

    const validDropoff = validateReturnTransition("approved", "counter_dropoff");
    expect(validDropoff.valid).toBe(true);

    // Terminal states cannot transition without override
    const terminalCheck = validateReturnTransition("return_completed", "requested");
    expect(terminalCheck.valid).toBe(false);

    const overrideCheck = validateReturnTransition("return_completed", "requested", true);
    expect(overrideCheck.valid).toBe(true);
  });

  it("should enforce valid refund transitions and guard against premature settlement", () => {
    // Pending review cannot transition directly to paid without approved/pending_payout
    const directPay = validateRefundTransition("pending_review", "paid");
    expect(directPay.valid).toBe(false);

    // Pending payout can transition to paid
    const validPay = validateRefundTransition("pending_payout", "paid");
    expect(validPay.valid).toBe(true);

    // Once paid, customer can transition to disputed
    const validDispute = validateRefundTransition("paid", "disputed");
    expect(validDispute.valid).toBe(true);

    // Paid cannot jump to pending_review directly without dispute
    const invalidReset = validateRefundTransition("paid", "pending_review");
    expect(invalidReset.valid).toBe(false);
  });
});

describe("BS-FINAL-02: Security, Privacy & Sensitive Data Masking", () => {
  it("should mask customer bank account numbers to protect sensitive financial data", () => {
    const rawBankDetails = {
      accountHolderName: "Sayan Basani",
      accountNumber: "123456789012",
      ifsc: "HDFC0001234",
      bankName: "HDFC Bank",
    };

    const masked = maskDestinationDetails(rawBankDetails);
    expect(masked.accountNumber).toBe("****9012");
    expect(masked.accountHolderName).toBe("Sayan Basani");
    expect(masked.ifsc).toBe("HDFC0001234");
    expect(masked.bankName).toBe("HDFC Bank");
  });

  it("should preserve UPI ID without mangling", () => {
    const rawUpi = { upiId: "user@okaxis" };
    const masked = maskDestinationDetails(rawUpi);
    expect(masked.upiId).toBe("user@okaxis");
  });
});

describe("BS-FINAL-02: Customer Dispute and Idempotent Payout Safeguards", () => {
  const returnDetailRouteSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/returns/[id]/route.ts"),
    "utf-8"
  );
  const disputeRouteSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/api/returns/[id]/dispute/route.ts"),
    "utf-8"
  );

  it("should verify idempotent duplicate payout protection in return updates", () => {
    expect(returnDetailRouteSource).toContain("Refund has already been paid and settled. Re-disbursement is prevented");
    expect(returnDetailRouteSource).toContain("Duplicate payout reference");
    expect(returnDetailRouteSource).toContain("refundTransactionReference");
  });

  it("should provide a dedicated customer dispute endpoint that alerts administrators", () => {
    expect(disputeRouteSource).toContain("refundStatus: \"disputed\"");
    expect(disputeRouteSource).toContain("refundDisputeReason");
    expect(disputeRouteSource).toContain("URGENT: Refund Disputed");
  });
});
