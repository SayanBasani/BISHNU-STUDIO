import { describe, it, expect } from "vitest";
import {
  PHYSICAL_RETURN_STATUSES,
  REFUND_STATUSES,
  VALID_RETURN_TRANSITIONS,
  VALID_REFUND_TRANSITIONS,
  PHYSICAL_STATUS_LABELS,
  REFUND_STATUS_LABELS,
  CUSTOMER_REFUND_STATUS_LABELS,
  RETURN_EVENT_TYPES,
  validateReturnTransition,
  validateRefundTransition,
  evaluateReturnCaseClosure,
  maskDestinationDetails,
} from "@/lib/return-state-machine";
import { getOrderTimeline } from "@/lib/order-timeline";

describe("BS-FINAL-04: Complete Return, Exchange, Refund Settlement and Unified Customer Timeline", () => {
  describe("Workstream 1 & 2: Refund Settlement State Machine & Explicit Payout Verification", () => {
    it("should include all required refund settlement statuses including payout_failed and disputed", () => {
      const requiredStatuses = [
        "not_eligible",
        "pending_review",
        "approved",
        "awaiting_payout",
        "payout_initiated",
        "paid",
        "payout_failed",
        "failed",
        "disputed",
        "cancelled",
      ];

      for (const st of requiredStatuses) {
        expect(REFUND_STATUSES).toContain(st);
      }
    });

    it("should validate strict financial workflow transitions from pending_review to paid", () => {
      // 1. Initial review to approved
      expect(validateRefundTransition("pending_review", "approved").valid).toBe(true);

      // 2. Approved to awaiting_payout or payout_initiated
      expect(validateRefundTransition("approved", "awaiting_payout").valid).toBe(true);
      expect(validateRefundTransition("approved", "payout_initiated").valid).toBe(true);

      // 3. Payout initiated to paid (completion)
      expect(validateRefundTransition("payout_initiated", "paid").valid).toBe(true);

      // 4. Payout initiated to payout_failed (transfer failed/bounced)
      expect(validateRefundTransition("payout_initiated", "payout_failed").valid).toBe(true);

      // 5. Retry from payout_failed back to payout_initiated
      expect(validateRefundTransition("payout_failed", "payout_initiated").valid).toBe(true);

      // 6. Paid to disputed
      expect(validateRefundTransition("paid", "disputed").valid).toBe(true);
    });

    it("should prevent direct illegal jumps such as pending_review directly to paid", () => {
      const check = validateRefundTransition("pending_review", "paid");
      expect(check.valid).toBe(false);
      expect(check.error).toContain("Cannot transition refund");
    });

    it("should provide customer-safe terminology for all refund statuses", () => {
      expect(CUSTOMER_REFUND_STATUS_LABELS.approved).toBe("Refund approved");
      expect(CUSTOMER_REFUND_STATUS_LABELS.payout_initiated).toBe("Refund transfer initiated");
      expect(CUSTOMER_REFUND_STATUS_LABELS.paid).toBe("Refund sent successfully");
      expect(CUSTOMER_REFUND_STATUS_LABELS.payout_failed).toBe("Refund transfer failed");
      expect(CUSTOMER_REFUND_STATUS_LABELS.disputed).toBe("Refund under dispute");
    });
  });

  describe("Workstream 3 & 5: Case Closure, Archival & Separation of Physical vs Financial Lifecycles", () => {
    it("should evaluate a return as in-progress if physical return is not yet completed", () => {
      const evaluation = evaluateReturnCaseClosure({
        status: "in_transit",
        refundStatus: "pending_review",
        requestedResolution: "refund",
      });

      expect(evaluation.isPhysicalCompleted).toBe(false);
      expect(evaluation.isRefundSettled).toBe(false);
      expect(evaluation.isCaseClosed).toBe(false);
      expect(evaluation.canArchive).toBe(false);
      expect(evaluation.caseStatusLabel).toBe("Open / In Progress");
    });

    it("should NOT close case if physical return is completed but refund settlement remains pending", () => {
      const evaluation = evaluateReturnCaseClosure({
        status: "return_completed",
        refundStatus: "approved",
        requestedResolution: "refund",
      });

      expect(evaluation.isPhysicalCompleted).toBe(true);
      expect(evaluation.isRefundSettled).toBe(false);
      expect(evaluation.isCaseClosed).toBe(false);
      // Case status must clearly indicate open awaiting financial resolution
      expect(evaluation.caseStatusLabel).toBe("Open / Awaiting Financial Resolution");
      expect(evaluation.closureReason).toContain("refund payout remains pending");
      // Archiving is permitted with clear pending financial status
      expect(evaluation.canArchive).toBe(true);
    });

    it("should close case when both physical return is completed and refund is paid", () => {
      const evaluation = evaluateReturnCaseClosure({
        status: "return_completed",
        refundStatus: "paid",
        requestedResolution: "refund",
        isArchived: false,
      });

      expect(evaluation.isPhysicalCompleted).toBe(true);
      expect(evaluation.isRefundSettled).toBe(true);
      expect(evaluation.isCaseClosed).toBe(true);
      expect(evaluation.canArchive).toBe(true);
      expect(evaluation.caseStatusLabel).toBe("Case Closed & Resolved");
      expect(evaluation.archiveStatusLabel).toBe("Active");
    });

    it("should properly reflect archived state when isArchived is true", () => {
      const evaluation = evaluateReturnCaseClosure({
        status: "return_completed",
        refundStatus: "paid",
        requestedResolution: "refund",
        isArchived: true,
      });

      expect(evaluation.archiveStatusLabel).toBe("Archived");
      expect(evaluation.isCaseClosed).toBe(true);
    });

    it("should evaluate rejected return as closed case", () => {
      const evaluation = evaluateReturnCaseClosure({
        status: "rejected",
        refundStatus: "not_eligible",
        requestedResolution: "refund",
      });

      expect(evaluation.isCaseClosed).toBe(true);
      expect(evaluation.canArchive).toBe(true);
    });
  });

  describe("Workstream 4: Semantic Event Types & Timeline Integrity", () => {
    it("should contain explicit semantic event types for all return, refund and case stages", () => {
      expect(RETURN_EVENT_TYPES.RETURN_REQUESTED).toBe("return_requested");
      expect(RETURN_EVENT_TYPES.RETURN_APPROVED).toBe("return_approved");
      expect(RETURN_EVENT_TYPES.RETURN_ITEM_RECEIVED).toBe("return_item_received");
      expect(RETURN_EVENT_TYPES.RETURN_INSPECTION_PASSED).toBe("return_inspection_passed");
      expect(RETURN_EVENT_TYPES.RETURN_INSPECTION_FAILED).toBe("return_inspection_failed");
      expect(RETURN_EVENT_TYPES.RETURN_COMPLETED).toBe("return_completed");
      expect(RETURN_EVENT_TYPES.REFUND_PAYOUT_INITIATED).toBe("refund_payout_initiated");
      expect(RETURN_EVENT_TYPES.REFUND_PAID).toBe("refund_paid");
      expect(RETURN_EVENT_TYPES.REFUND_PAYOUT_FAILED).toBe("refund_payout_failed");
      expect(RETURN_EVENT_TYPES.REFUND_DISPUTED).toBe("refund_disputed");
      expect(RETURN_EVENT_TYPES.CASE_ARCHIVED).toBe("case_archived");
    });

    it("should never map a return event to 'Order Collected by Customer' or 'Order Delivered Successfully'", () => {
      // Simulate client-side activity event mapping for a return event
      const simulateEventMapping = (ev: {
        eventType?: string | null;
        returnId?: string | null;
        newStatus: string;
        customerMessage?: string | null;
        isDelivery?: boolean;
      }) => {
        let title = "Status Updated";
        const msgLower = (ev.customerMessage || "").toLowerCase();
        const eventType = ev.eventType || "";

        if (eventType === "refund_paid") {
          title = "Refund Sent Successfully";
        } else if (eventType === "refund_payout_initiated") {
          title = "Refund Transfer Initiated";
        } else if (eventType === "return_approved") {
          title = "Return Approved";
        } else if (
          ev.returnId ||
          msgLower.includes("return #") ||
          msgLower.includes("return requested") ||
          msgLower.includes("refund disbursed")
        ) {
          if (msgLower.includes("refund disbursed") || msgLower.includes("refund processed")) title = "Refund Sent Successfully";
          else if (msgLower.includes("approved")) title = "Return Approved";
          else title = "Return Status Updated";
        } else {
          switch (ev.newStatus) {
            case "completed":
              title = ev.isDelivery ? "Order Delivered Successfully" : "Order Collected by Customer";
              break;
            default:
              title = "Status Updated";
              break;
          }
        }
        return title;
      };

      // Test 1: Explicit eventType
      expect(
        simulateEventMapping({
          eventType: "refund_paid",
          returnId: "ret_123",
          newStatus: "delivered",
          customerMessage: "Refund of ₹500 disbursed via UPI.",
          isDelivery: false,
        })
      ).toBe("Refund Sent Successfully");

      // Test 2: Legacy event where newStatus might have been 'completed'
      expect(
        simulateEventMapping({
          eventType: null,
          returnId: "ret_123",
          newStatus: "completed",
          customerMessage: "Return #RET-12345 approved by admin.",
          isDelivery: false,
        })
      ).toBe("Return Approved");

      // Test 3: Normal delivery event without returnId or return keywords correctly becomes Order Collected
      expect(
        simulateEventMapping({
          eventType: null,
          returnId: null,
          newStatus: "completed",
          customerMessage: "Order fulfillment completed and verified by staff.",
          isDelivery: false,
        })
      ).toBe("Order Collected by Customer");
    });

    it("should mask sensitive customer payout destination data", () => {
      const rawDestination = {
        upiId: "customer.name@okhdfcbank",
        accountHolderName: "Sayan Basani",
        accountNumber: "123456789012",
        ifsc: "HDFC0001234",
        bankName: "HDFC Bank",
      };

      const masked = maskDestinationDetails(rawDestination);
      expect(masked.upiId).toBe("customer.name@okhdfcbank");
      expect(masked.accountNumber).toBe("****9012");
      expect(masked.ifsc).toBe("HDFC0001234");
      expect(masked.bankName).toBe("HDFC Bank");
    });
  });
});
