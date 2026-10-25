/**
 * Bishnu Studio — Return and Refund State Machine & Eligibility Engine
 * 
 * Enforces strict return eligibility, item-level returnable quantity calculations,
 * validated status transitions, and idempotent inventory restocking.
 */

export const RETURN_STATUSES = [
  "requested",
  "under_review",
  "approved",
  "rejected",
  "pickup_scheduled",
  "in_transit",
  "received",
  "inspection_in_progress",
  "refund_pending",
  "refund_processed",
  "exchange_processing",
  "completed",
  "cancelled",
] as const;

export type ReturnStatus = typeof RETURN_STATUSES[number];

export const VALID_RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ["under_review", "approved", "rejected", "cancelled"],
  under_review: ["approved", "rejected", "cancelled"],
  approved: ["pickup_scheduled", "in_transit", "received", "cancelled"],
  pickup_scheduled: ["in_transit", "received", "cancelled"],
  in_transit: ["received", "cancelled"],
  received: ["inspection_in_progress", "refund_pending", "exchange_processing", "rejected"],
  inspection_in_progress: ["refund_pending", "exchange_processing", "rejected", "completed"],
  refund_pending: ["refund_processed", "cancelled"],
  refund_processed: ["completed"],
  exchange_processing: ["completed"],
  completed: [], // Terminal
  rejected: [], // Terminal
  cancelled: [], // Terminal
};

/**
 * Validates whether a return status transition is allowed.
 */
export function validateReturnTransition(
  currentStatus: string,
  targetStatus: string,
  allowAdminOverride: boolean = false
): { valid: boolean; error?: string } {
  if (currentStatus === targetStatus) {
    return { valid: true };
  }

  const validNext = VALID_RETURN_TRANSITIONS[currentStatus as ReturnStatus];

  if (!validNext) {
    return {
      valid: false,
      error: `Unknown current return status: ${currentStatus}`,
    };
  }

  if (validNext.includes(targetStatus as ReturnStatus)) {
    return { valid: true };
  }

  if (currentStatus === "completed" || currentStatus === "rejected" || currentStatus === "cancelled") {
    if (!allowAdminOverride) {
      return {
        valid: false,
        error: `Return #${currentStatus} is in a terminal state and cannot be modified through standard workflow.`,
      };
    }
  }

  if (allowAdminOverride) {
    return { valid: true };
  }

  return {
    valid: false,
    error: `Cannot transition return from '${currentStatus.replace(/_/g, " ")}' to '${targetStatus.replace(/_/g, " ")}'. Allowed next stages: ${validNext.join(", ") || "None (Terminal)"}.`,
  };
}

/**
 * Generates an auditable return reference number (e.g. RET-202610-4821)
 */
export function generateReturnReference(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `RET-${year}${month}-${randomSuffix}`;
}

/**
 * Evaluates return eligibility for an order and its items.
 */
export interface ReturnEligibilityCheck {
  isEligible: boolean;
  reason?: string;
  daysRemaining?: number;
  returnableItems: Array<{
    orderItemId: string;
    itemType: string;
    productName?: string;
    quantityOrdered: number;
    quantityPreviouslyReturned: number;
    eligibleQuantity: number;
    unitPrice: number;
    isCustomService: boolean;
    ineligibilityReason?: string;
  }>;
}

export function evaluateOrderReturnEligibility(
  order: {
    id: string;
    orderStatus: string;
    deliveredAt?: number | null;
    createdAt: number;
  },
  orderItems: Array<{
    id: string;
    itemType: string;
    quantity: number;
    unitPriceSnapshot: number;
    productId?: string | null;
    configurationJson?: string | null;
  }>,
  existingReturnItems: Array<{
    orderItemId: string;
    quantity: number;
    status: string;
  }>,
  returnWindowDays: number = 7
): ReturnEligibilityCheck {
  // Rule 1: Order must be delivered/completed
  if (order.orderStatus !== "completed") {
    return {
      isEligible: false,
      reason: "Returns can only be requested once an order has been completed and delivered.",
      returnableItems: [],
    };
  }

  // Rule 2: Delivered timestamp check within configured return window
  const referenceTimestamp = order.deliveredAt || order.createdAt;
  const msElapsed = Date.now() - referenceTimestamp;
  const daysElapsed = Math.floor(msElapsed / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, returnWindowDays - daysElapsed);

  if (daysElapsed > returnWindowDays) {
    return {
      isEligible: false,
      reason: `Return window expired. Orders can only be returned within ${returnWindowDays} days of delivery (${daysElapsed} days elapsed).`,
      daysRemaining: 0,
      returnableItems: [],
    };
  }

  // Calculate previously returned quantities for active/approved returns
  const activeReturnMap = new Map<string, number>();
  for (const ret of existingReturnItems) {
    if (ret.status !== "rejected" && ret.status !== "cancelled") {
      const current = activeReturnMap.get(ret.orderItemId) || 0;
      activeReturnMap.set(ret.orderItemId, current + ret.quantity);
    }
  }

  const returnableItems: ReturnEligibilityCheck["returnableItems"] = [];
  let hasAtLeastOneEligibleItem = false;

  for (const item of orderItems) {
    const prevReturned = activeReturnMap.get(item.id) || 0;
    const remainingQty = Math.max(0, item.quantity - prevReturned);

    // Custom printed items (PVC cards, printed customer files, photos) have special handling
    const isCustomService = item.itemType !== "product";
    let ineligibilityReason: string | undefined = undefined;

    if (remainingQty <= 0) {
      ineligibilityReason = "All ordered units have already been returned or have pending return requests.";
    }

    if (remainingQty > 0 && !ineligibilityReason) {
      hasAtLeastOneEligibleItem = true;
    }

    returnableItems.push({
      orderItemId: item.id,
      itemType: item.itemType,
      quantityOrdered: item.quantity,
      quantityPreviouslyReturned: prevReturned,
      eligibleQuantity: remainingQty,
      unitPrice: item.unitPriceSnapshot,
      isCustomService,
      ineligibilityReason,
    });
  }

  return {
    isEligible: hasAtLeastOneEligibleItem,
    reason: hasAtLeastOneEligibleItem
      ? undefined
      : "No items in this order are currently eligible for return.",
    daysRemaining,
    returnableItems,
  };
}
