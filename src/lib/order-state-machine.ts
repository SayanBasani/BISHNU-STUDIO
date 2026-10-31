/**
 * Bishnu Studio — Order Lifecycle & Fulfillment State Machine
 * 
 * Enforces explicit, auditable order status transitions and validates delivery tracking.
 * 
 * Independent State Dimensions:
 * 1. Order Lifecycle (orderStatus): pending -> confirmed -> processing -> ready/out -> completed | cancelled
 * 2. Payment Status (paymentStatus): unpaid, awaiting_payment, pending_verification, paid, refunded, failed
 * 3. Fulfillment Status (fulfillmentStatus): unfulfilled, preparing, ready_for_pickup, in_transit, out_for_delivery, delivered
 * 4. Return Status: managed independently via order_returns table
 */

export const ORDER_LIFECYCLE_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "ready_for_collection",
  "out_for_delivery",
  "completed",
  "cancelled",
] as const;

export type OrderLifecycleStatus = typeof ORDER_LIFECYCLE_STATUSES[number];

export const FULFILLMENT_STATUSES = [
  "unfulfilled",
  "preparing",
  "ready_for_pickup",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed_delivery",
] as const;

export type FulfillmentStatus = typeof FULFILLMENT_STATUSES[number];

export const CANONICAL_PAYMENT_STATUSES = [
  "unpaid",
  "awaiting_payment",
  "payment_initiated",
  "pending_verification",
  "paid",
  "rejected",
  "failed",
  "refunded",
  "review_required",
  "pending",
] as const;

export type CanonicalPaymentStatus = typeof CANONICAL_PAYMENT_STATUSES[number];

export const VALID_ORDER_TRANSITIONS: Record<OrderLifecycleStatus, OrderLifecycleStatus[]> = {
  pending: ["confirmed", "processing", "cancelled"],
  confirmed: ["processing", "ready_for_collection", "out_for_delivery", "cancelled"],
  processing: ["ready_for_collection", "out_for_delivery", "completed", "confirmed", "cancelled"],
  ready_for_collection: ["out_for_delivery", "completed", "processing", "cancelled"],
  out_for_delivery: ["completed", "ready_for_collection", "processing", "cancelled"],
  completed: [], // Terminal for standard workflow. Returns handled via Return State Machine.
  cancelled: [], // Terminal
};

export interface OrderTransitionOptions {
  allowAdminOverride?: boolean;
  deliveryType?: string;
  courierName?: string | null;
  trackingNumber?: string | null;
}

/**
 * Validates whether an order status transition is permissible.
 */
export function validateOrderTransition(
  currentStatus: string,
  targetStatus: string,
  allowAdminOverrideOrOptions: boolean | OrderTransitionOptions = false
): { valid: boolean; error?: string } {
  if (currentStatus === targetStatus) {
    return { valid: true };
  }

  const isBool = typeof allowAdminOverrideOrOptions === "boolean";
  const allowAdminOverride = isBool
    ? allowAdminOverrideOrOptions
    : Boolean(allowAdminOverrideOrOptions?.allowAdminOverride);
  const options: OrderTransitionOptions = isBool
    ? {}
    : allowAdminOverrideOrOptions || {};

  const validNext = VALID_ORDER_TRANSITIONS[currentStatus as OrderLifecycleStatus];

  if (!validNext) {
    return {
      valid: false,
      error: `Unknown current order status: ${currentStatus}`,
    };
  }

  // Prevent accidental backward transitions from completed or cancelled
  if (currentStatus === "completed") {
    if (!allowAdminOverride) {
      return {
        valid: false,
        error: "Completed orders are finalized and cannot be moved backward via standard status controls. Customer returns or issues must be handled through the dedicated Returns workflow.",
      };
    }
    return { valid: true };
  }

  if (currentStatus === "cancelled") {
    if (!allowAdminOverride) {
      return {
        valid: false,
        error: "Cancelled orders cannot be reopened through normal status controls.",
      };
    }
    return { valid: true };
  }

  // Guard against courier dispatch transitions on store pickup orders
  if (
    options.deliveryType === "store_pickup" &&
    targetStatus === "out_for_delivery" &&
    !allowAdminOverride
  ) {
    return {
      valid: false,
      error: "Store pickup orders do not have courier delivery. Transition directly to 'ready_for_collection' (Ready for Pickup) or 'completed' (Collected).",
    };
  }

  if (validNext.includes(targetStatus as OrderLifecycleStatus)) {
    return { valid: true };
  }

  if (allowAdminOverride) {
    return { valid: true };
  }

  return {
    valid: false,
    error: `Cannot transition order status from '${currentStatus}' to '${targetStatus}'. Allowed transitions: ${validNext.join(", ") || "None (Terminal status)"}.`,
  };
}

/**
 * Validates tracking URL safety (prevents Stored XSS, javascript: schemes, etc.)
 */
export function validateTrackingUrl(url: string | null | undefined): {
  valid: boolean;
  error?: string;
  safeUrl?: string | null;
} {
  if (!url || url.trim() === "") {
    return { valid: true, safeUrl: null };
  }

  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();

  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:")
  ) {
    return {
      valid: false,
      error: "Unsafe URL scheme detected. Only valid HTTP or HTTPS tracking links are permitted.",
    };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return { valid: true, safeUrl: trimmed };
    }
    return {
      valid: false,
      error: "Tracking URL must use HTTP or HTTPS protocol.",
    };
  } catch {
    return {
      valid: false,
      error: "Invalid URL format. Please provide a complete URL starting with https://",
    };
  }
}

/**
 * Categorizes an order based on its item specifications.
 */
export function determineOrderCategory(items: any[] = []): "retail" | "service" | "mixed" {
  if (!items || items.length === 0) return "retail";

  const serviceTypes = new Set(["pvc_card", "document_print", "lamination", "photo_print"]);
  let hasService = false;
  let hasRetail = false;

  for (const item of items) {
    const type = item.itemType || "";
    if (serviceTypes.has(type)) {
      hasService = true;
    } else {
      hasRetail = true;
    }
  }

  if (hasService && hasRetail) return "mixed";
  if (hasService) return "service";
  return "retail";
}

export interface FulfillmentMilestone {
  key: string;
  title: string;
  subtitle: string;
  stepIndex: number;
}

/**
 * Returns contextual fulfillment milestones depending on delivery method and product nature.
 */
export function getFulfillmentMilestones(options: {
  deliveryType: string;
  orderCategory?: "retail" | "service" | "mixed";
  isService?: boolean;
}): FulfillmentMilestone[] {
  const isDelivery = options.deliveryType === "home_delivery" || options.deliveryType === "courier_delivery";
  const isServiceOrder = options.isService ?? (options.orderCategory === "service" || options.orderCategory === "mixed");

  if (isDelivery) {
    if (isServiceOrder) {
      return [
        { key: "placed", title: "Order Placed", subtitle: "Files & specs submitted", stepIndex: 0 },
        { key: "confirmed", title: "Confirmed & Approved", subtitle: "Specifications verified", stepIndex: 1 },
        { key: "processing", title: "Production in Progress", subtitle: "Printing, finishing & packing", stepIndex: 2 },
        { key: "out_for_delivery", title: "Dispatched / In Transit", subtitle: "Shipped via courier partner", stepIndex: 3 },
        { key: "completed", title: "Delivered", subtitle: "Delivered to your doorstep", stepIndex: 4 },
      ];
    } else {
      return [
        { key: "placed", title: "Order Placed", subtitle: "Order reference registered", stepIndex: 0 },
        { key: "confirmed", title: "Order Confirmed", subtitle: "Order & payment verified", stepIndex: 1 },
        { key: "processing", title: "Preparing Your Order", subtitle: "Items picked & packed", stepIndex: 2 },
        { key: "out_for_delivery", title: "Shipped / In Transit", subtitle: "Out with courier partner", stepIndex: 3 },
        { key: "completed", title: "Delivered", subtitle: "Delivered to your doorstep", stepIndex: 4 },
      ];
    }
  } else {
    // Customer Collection / Store Pickup
    if (isServiceOrder) {
      return [
        { key: "placed", title: "Order Placed", subtitle: "Files & specs submitted", stepIndex: 0 },
        { key: "confirmed", title: "Confirmed & Approved", subtitle: "Specifications verified", stepIndex: 1 },
        { key: "processing", title: "Production in Progress", subtitle: "Printing, finishing & packaging", stepIndex: 2 },
        { key: "ready_for_collection", title: "Ready for Collection", subtitle: "Ready at collection counter", stepIndex: 3 },
        { key: "completed", title: "Collected", subtitle: "Handed over to customer", stepIndex: 4 },
      ];
    } else {
      return [
        { key: "placed", title: "Order Placed", subtitle: "Order reference registered", stepIndex: 0 },
        { key: "confirmed", title: "Order Confirmed", subtitle: "Order & payment verified", stepIndex: 1 },
        { key: "processing", title: "Preparing Your Order", subtitle: "Items assembled & packed", stepIndex: 2 },
        { key: "ready_for_collection", title: "Ready for Collection", subtitle: "Ready at collection counter", stepIndex: 3 },
        { key: "completed", title: "Collected", subtitle: "Handed over to customer", stepIndex: 4 },
      ];
    }
  }
}

/**
 * Maps an order's status to its milestone step index (0 to 4).
 */
export function getActiveMilestoneIndex(orderStatus: string, deliveryType: string, isPaid = false): number {
  if (orderStatus === "completed") return 4;
  if (orderStatus === "out_for_delivery" || orderStatus === "ready_for_collection") return 3;
  if (orderStatus === "processing") return 2;
  if (orderStatus === "confirmed") return 1;
  return isPaid ? 1 : 0;
}

/**
 * Returns human-friendly customer-facing label for internal status.
 */
export function getCustomerFulfillmentLabel(
  status: string,
  deliveryType: string,
  isService = false
): string {
  const isDelivery = deliveryType === "home_delivery" || deliveryType === "courier_delivery";
  switch (status) {
    case "pending":
      return "Order Placed";
    case "confirmed":
      return "Order Confirmed";
    case "processing":
      return isService ? "Production in Progress" : "Preparing Your Order";
    case "ready_for_collection":
      return isDelivery ? "Ready for Dispatch" : "Ready for Collection";
    case "out_for_delivery":
      return isDelivery ? "Shipped / Out for Delivery" : "Ready for Collection";
    case "completed":
      return isDelivery ? "Delivered" : "Collected";
    case "cancelled":
      return "Cancelled";
    default:
      return status.replace(/_/g, " ");
  }
}
