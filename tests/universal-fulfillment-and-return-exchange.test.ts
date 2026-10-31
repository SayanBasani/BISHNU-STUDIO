import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  determineOrderCategory,
  getFulfillmentMilestones,
  getActiveMilestoneIndex,
  getCustomerFulfillmentLabel,
  validateOrderTransition,
} from "@/lib/order-state-machine";
import {
  PHYSICAL_RETURN_STATUSES,
  REFUND_STATUSES,
  EXCHANGE_STATUSES,
  PHYSICAL_STATUS_LABELS,
  REFUND_STATUS_LABELS,
  EXCHANGE_STATUS_LABELS,
  validateReturnTransition,
  validateRefundTransition,
  maskDestinationDetails,
} from "@/lib/return-state-machine";
import { resolveNotificationLink } from "@/lib/notifications";

describe("BS-FINAL-03: Universal Fulfillment, Return/Exchange Journey & Notification Routing", () => {
  describe("Workstream 1 & 2: Universal Order Fulfillment Model & Category Separation", () => {
    it("should classify orders accurately into retail, service, or mixed", () => {
      const retailItems = [
        { id: "item_1", itemType: "product", configurationJson: "{}" },
        { id: "item_2", itemType: "product", configurationJson: "{}" },
      ];
      expect(determineOrderCategory(retailItems)).toBe("retail");

      const serviceItems = [
        { id: "item_3", itemType: "pvc_card", configurationJson: "{}" },
        { id: "item_4", itemType: "photo_print", configurationJson: "{}" },
      ];
      expect(determineOrderCategory(serviceItems)).toBe("service");

      const mixedItems = [
        { id: "item_1", itemType: "product", configurationJson: "{}" },
        { id: "item_3", itemType: "pvc_card", configurationJson: "{}" },
      ];
      expect(determineOrderCategory(mixedItems)).toBe("mixed");
    });

    it("should generate retail milestones without print room processing for ordinary products", () => {
      const deliveryMilestones = getFulfillmentMilestones({
        deliveryType: "home_delivery",
        orderCategory: "retail",
      });

      expect(deliveryMilestones).toHaveLength(5);
      expect(deliveryMilestones[0].title).toBe("Order Placed");
      expect(deliveryMilestones[1].title).toBe("Order Confirmed");
      expect(deliveryMilestones[2].title).toBe("Preparing Your Order");
      expect(deliveryMilestones[2].subtitle).toBe("Items picked & packed");
      expect(deliveryMilestones[3].title).toContain("Shipped");
      expect(deliveryMilestones[4].title).toBe("Delivered");

      // Verify printing terms are NEVER included in retail order milestones
      const allText = deliveryMilestones.map((m) => `${m.title} ${m.subtitle}`).join(" ");
      expect(allText).not.toContain("Print Room Processing");
      expect(allText).not.toContain("Printing");
      expect(allText).not.toContain("Studio counter");
    });

    it("should generate collection milestones without shipping/courier terms for customer collection", () => {
      const collectionMilestones = getFulfillmentMilestones({
        deliveryType: "store_pickup",
        orderCategory: "retail",
      });

      expect(collectionMilestones).toHaveLength(5);
      expect(collectionMilestones[0].title).toBe("Order Placed");
      expect(collectionMilestones[1].title).toBe("Order Confirmed");
      expect(collectionMilestones[2].title).toBe("Preparing Your Order");
      expect(collectionMilestones[3].title).toBe("Ready for Collection");
      expect(collectionMilestones[3].subtitle).toContain("collection counter");
      expect(collectionMilestones[4].title).toBe("Collected");

      // Verify courier terms are NEVER included in customer collection
      const allText = collectionMilestones.map((m) => `${m.title} ${m.subtitle}`).join(" ");
      expect(allText).not.toContain("Out for Delivery");
      expect(allText).not.toContain("Courier dispatched");
      expect(allText).not.toContain("Shipped");
    });

    it("should allow production in progress milestones specifically for service orders", () => {
      const serviceMilestones = getFulfillmentMilestones({
        deliveryType: "home_delivery",
        orderCategory: "service",
      });

      expect(serviceMilestones[2].title).toBe("Production in Progress");
      expect(serviceMilestones[2].subtitle).toContain("Printing");
    });

    it("should validate order transitions and prevent invalid jumps", () => {
      // Valid forward progress
      expect(validateOrderTransition("pending", "confirmed").valid).toBe(true);
      expect(validateOrderTransition("confirmed", "processing").valid).toBe(true);
      expect(validateOrderTransition("processing", "ready_for_collection").valid).toBe(true);

      // Guard: store pickup cannot jump to out_for_delivery without admin override
      const pickupCheck = validateOrderTransition("ready_for_collection", "out_for_delivery", {
        deliveryType: "store_pickup",
      });
      expect(pickupCheck.valid).toBe(false);
      expect(pickupCheck.error).toContain("Store pickup orders do not have courier delivery");

      // Completed orders are finalized and protected
      const completedCheck = validateOrderTransition("completed", "processing");
      expect(completedCheck.valid).toBe(false);
      expect(completedCheck.error).toContain("Completed orders are finalized");
    });
  });

  describe("Workstream 3 & 4: Return & Exchange Lifecycle & Prominent Customer Tracking", () => {
    it("should support both refund and exchange resolutions with independent status enums", () => {
      expect(EXCHANGE_STATUSES).toContain("requested");
      expect(EXCHANGE_STATUSES).toContain("approved");
      expect(EXCHANGE_STATUSES).toContain("replacement_created");
      expect(EXCHANGE_STATUSES).toContain("dispatched");
      expect(EXCHANGE_STATUSES).toContain("completed");

      expect(REFUND_STATUSES).toContain("pending_review");
      expect(REFUND_STATUSES).toContain("approved");
      expect(REFUND_STATUSES).toContain("awaiting_payout");
      expect(REFUND_STATUSES).toContain("paid");
      expect(REFUND_STATUSES).toContain("disputed");
    });

    it("should verify customer order detail page renders prominent return section after delivery", () => {
      const orderDetailPath = path.resolve(
        process.cwd(),
        "src/app/account/orders/[id]/page.tsx"
      );
      const code = fs.readFileSync(orderDetailPath, "utf-8");

      // Check prominent placement before main items grid
      const returnsPos = code.indexOf('id="returns-section"');
      const mainGridPos = code.indexOf("Main Grid: Items & Specs");
      expect(returnsPos).toBeGreaterThan(-1);
      expect(mainGridPos).toBeGreaterThan(-1);
      expect(returnsPos).toBeLessThan(mainGridPos);

      // Check Active Return & Refund Journey headers and badges
      expect(code).toContain("Active Return &amp; Refund Journey");
      expect(code).toContain("Return / Exchange Active");
      expect(code).toContain("Current Stage &amp; Next Action");
      expect(code).toContain("Replacement Fulfillment");
      expect(code).toContain("Inspect Payout Receipt");
      expect(code).toContain("Dispute Refund / Payment Not Received");
    });

    it("should map return status transitions safely with valid next actions", () => {
      expect(validateReturnTransition("requested", "approved").valid).toBe(true);
      expect(validateReturnTransition("approved", "pickup_scheduled").valid).toBe(true);
      expect(validateReturnTransition("pickup_scheduled", "picked_up").valid).toBe(true);
      expect(validateReturnTransition("picked_up", "in_transit").valid).toBe(true);
      expect(validateReturnTransition("in_transit", "received_at_studio").valid).toBe(true);
      expect(validateReturnTransition("received_at_studio", "inspection_in_progress").valid).toBe(true);
      expect(validateReturnTransition("inspection_in_progress", "inspection_passed").valid).toBe(true);

      // Illegal backward transition
      expect(validateReturnTransition("return_completed", "requested").valid).toBe(false);
    });
  });

  describe("Workstream 5 & 6: Refund Settlement Approval Separation & Payout Guard", () => {
    it("should permit approval without marking refund as paid", () => {
      const approveCheck = validateRefundTransition("pending_review", "approved");
      expect(approveCheck.valid).toBe(true);

      const awaitingCheck = validateRefundTransition("approved", "awaiting_payout");
      expect(awaitingCheck.valid).toBe(true);

      // Paid cannot jump straight from pending_review
      const directPaidCheck = validateRefundTransition("pending_review", "paid");
      expect(directPaidCheck.valid).toBe(false);
    });

    it("should guard that once paid, refund can only transition to disputed", () => {
      const disputeCheck = validateRefundTransition("paid", "disputed");
      expect(disputeCheck.valid).toBe(true);

      const invalidJump = validateRefundTransition("paid", "pending_review");
      expect(invalidJump.valid).toBe(false);
    });

    it("should mask customer destination bank and phone information", () => {
      const masked = maskDestinationDetails({
        accountNumber: "987654321012",
        upiId: "customer@okhdfcbank",
        contactPhone: "9876543210",
      });

      expect(masked.accountNumber).toBe("****1012");
    });
  });

  describe("Workstream 7: Deterministic Notification Routing", () => {
    it("should resolve admin return notifications strictly to /admin/returns/[returnId]", () => {
      const route = resolveNotificationLink({
        recipientType: "admin",
        entityType: "return",
        entityId: "ret_10482_sample",
        linkUrl: "/admin/orders/ord_sample", // Mistaken caller URL
      });

      expect(route).toBe("/admin/returns/ret_10482_sample");
    });

    it("should resolve customer return notifications to order detail with return anchor", () => {
      const route = resolveNotificationLink({
        recipientType: "customer",
        entityType: "return",
        entityId: "ret_10482_sample",
        linkUrl: "/account/orders/ord_sample",
      });

      expect(route).toBe("/account/orders/ord_sample#return-ret_10482_sample");
    });

    it("should resolve order notifications correctly for admin and customer", () => {
      const adminOrderRoute = resolveNotificationLink({
        recipientType: "admin",
        entityType: "order",
        entityId: "ord_9999",
      });
      expect(adminOrderRoute).toBe("/admin/orders/ord_9999");

      const custOrderRoute = resolveNotificationLink({
        recipientType: "customer",
        entityType: "order",
        entityId: "ord_9999",
      });
      expect(custOrderRoute).toBe("/account/orders/ord_9999");
    });
  });

  describe("Workstream 8: Business Terminology Generalization", () => {
    it("should provide neutral operational labels without hardcoded studio prefixes", () => {
      expect(PHYSICAL_STATUS_LABELS["under_review"]).toBe("Under Review");
      expect(PHYSICAL_STATUS_LABELS["in_transit"]).toBe("In Transit to Return Location");
      expect(PHYSICAL_STATUS_LABELS["received_at_studio"]).toBe("Received at Return Location");
      expect(PHYSICAL_STATUS_LABELS["received"]).toBe("Received at Return Location");

      expect(REFUND_STATUS_LABELS["approved"]).toBe("Approved for Disbursement");
      expect(REFUND_STATUS_LABELS["awaiting_payout"]).toBe("Awaiting Payout Execution");
      expect(REFUND_STATUS_LABELS["paid"]).toBe("Refund Paid & Settled");

      expect(EXCHANGE_STATUS_LABELS["replacement_created"]).toBe("Replacement Order Created");
    });

    it("should verify admin order details uses universal fulfillment terminology", () => {
      const adminOrderCode = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/admin/orders/[id]/page.tsx"),
        "utf-8"
      );

      // Must not contain hardcoded "Processing in Studio" option
      expect(adminOrderCode).not.toContain('<option value="processing">Processing in Studio</option>');
      expect(adminOrderCode).toContain('<option value="processing">Preparing Order / In Progress</option>');
    });

    it("should verify admin returns details uses generalized location labels", () => {
      const adminReturnCode = fs.readFileSync(
        path.resolve(process.cwd(), "src/app/admin/returns/[id]/page.tsx"),
        "utf-8"
      );

      expect(adminReturnCode).not.toContain('label: "Under Review by Studio Staff"');
      expect(adminReturnCode).toContain('label: "Under Review"');
      expect(adminReturnCode).not.toContain('label: "Received at Studio"');
      expect(adminReturnCode).toContain('label: "Received at Return Location"');
    });
  });
});
