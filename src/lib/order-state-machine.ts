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
