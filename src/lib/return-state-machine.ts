/**
 * Bishnu Studio — Return and Refund State Machine & Eligibility Engine
 * 
 * Enforces strict physical return workflows, separate financial refund lifecycles,
 * evidence tracking (UPI proof, Bank UTR, signed Cash receipts), idempotency,
 * and masked sensitive destination data.
 */

// 1. Physical Return Statuses
export const PHYSICAL_RETURN_STATUSES = [
  "requested",
  "under_review",
  "approved",
  "pickup_scheduled",
  "pickup_failed",
  "picked_up",
  "counter_dropoff",
  "in_transit",
  "received_at_studio",
  "received", // backward compatibility alias
  "inspection_in_progress",
  "inspection_passed",
  "inspection_failed",
  "return_completed",
  "completed", // backward compatibility alias
  "rejected",
  "cancelled",
  // Legacy hybrid statuses for full backward compatibility:
  "refund_pending",
  "refund_processed",
  "exchange_processing",
] as const;

export const RETURN_STATUSES = PHYSICAL_RETURN_STATUSES;

export type ReturnStatus = typeof PHYSICAL_RETURN_STATUSES[number];

// Allowed Physical Return Transitions
export const VALID_RETURN_TRANSITIONS: Record<string, string[]> = {
  requested: ["under_review", "approved", "rejected", "cancelled"],
  under_review: ["approved", "rejected", "cancelled"],
  approved: [
    "pickup_scheduled",
    "picked_up",
    "counter_dropoff",
    "in_transit",
    "received_at_studio",
    "received",
    "cancelled",
  ],
  pickup_scheduled: [
    "picked_up",
    "pickup_failed",
    "counter_dropoff",
    "in_transit",
    "received_at_studio",
    "received",
    "cancelled",
  ],
  pickup_failed: ["pickup_scheduled", "counter_dropoff", "cancelled"],
  picked_up: ["in_transit", "received_at_studio", "received", "cancelled"],
  counter_dropoff: [
    "received_at_studio",
    "received",
    "inspection_in_progress",
    "cancelled",
  ],
  in_transit: ["received_at_studio", "received", "cancelled"],
  received_at_studio: [
    "inspection_in_progress",
    "inspection_passed",
    "inspection_failed",
    "return_completed",
    "completed",
    "rejected",
  ],
  received: [
    "inspection_in_progress",
    "inspection_passed",
    "inspection_failed",
    "refund_pending",
    "exchange_processing",
    "rejected",
  ],
  inspection_in_progress: [
    "inspection_passed",
    "inspection_failed",
    "return_completed",
    "completed",
    "refund_pending",
    "exchange_processing",
    "rejected",
  ],
  inspection_passed: ["return_completed", "completed"],
  inspection_failed: ["return_completed", "completed", "rejected"],
  refund_pending: ["refund_processed", "return_completed", "completed", "cancelled"],
  refund_processed: ["return_completed", "completed"],
  exchange_processing: ["return_completed", "completed"],
  return_completed: [], // Terminal
  completed: [], // Terminal
  rejected: [], // Terminal
  cancelled: [], // Terminal
};

// 2. Refund Settlement Workflow Statuses
export const REFUND_STATUSES = [
  "not_eligible",
  "pending_review",
  "approved",
  "awaiting_payout",
  "pending_payout",
  "payout_recorded",
  "payout_initiated",
  "paid",
  "failed",
  "disputed",
  "cancelled",
] as const;

export type RefundStatus = typeof REFUND_STATUSES[number];

// Allowed Refund Settlement Transitions
export const VALID_REFUND_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  not_eligible: ["pending_review"],
  pending_review: ["approved", "not_eligible", "cancelled"],
  approved: ["awaiting_payout", "pending_payout", "payout_recorded", "payout_initiated", "cancelled"],
  awaiting_payout: ["payout_recorded", "payout_initiated", "paid", "failed", "cancelled"],
  pending_payout: ["payout_recorded", "payout_initiated", "paid", "failed", "cancelled"],
  payout_recorded: ["paid", "failed", "disputed"],
  payout_initiated: ["paid", "failed", "disputed"],
  paid: ["disputed"], // Guard: Once paid, can only transition to disputed if customer raises issue
  failed: ["awaiting_payout", "pending_payout", "cancelled"],
  disputed: ["pending_review", "awaiting_payout", "pending_payout", "paid", "cancelled"],
  cancelled: [], // Terminal
};

// 3. Exchange & Replacement Workflow Statuses
export const EXCHANGE_STATUSES = [
  "requested",
  "under_review",
  "approved",
  "replacement_created",
  "dispatched",
  "completed",
  "rejected",
  "cancelled",
] as const;

export type ExchangeStatus = typeof EXCHANGE_STATUSES[number];

export const VALID_EXCHANGE_TRANSITIONS: Record<ExchangeStatus, ExchangeStatus[]> = {
  requested: ["under_review", "approved", "rejected", "cancelled"],
  under_review: ["approved", "rejected", "cancelled"],
  approved: ["replacement_created", "rejected", "cancelled"],
  replacement_created: ["dispatched", "completed", "cancelled"],
  dispatched: ["completed", "cancelled"],
  completed: [], // Terminal
  rejected: [], // Terminal
  cancelled: [], // Terminal
};

// Human-friendly operational labels (generalized, zero hardcoded studio terms)
export const PHYSICAL_STATUS_LABELS: Record<string, string> = {
  requested: "Return Requested",
  under_review: "Under Review",
  approved: "Return Approved",
  pickup_scheduled: "Pickup Scheduled",
  pickup_failed: "Pickup Attempt Failed",
  picked_up: "Picked Up by Courier",
  counter_dropoff: "Dropped Off at Counter",
  in_transit: "In Transit to Return Location",
  received_at_studio: "Received at Return Location",
  received: "Received at Return Location",
  inspection_in_progress: "Quality Inspection in Progress",
  inspection_passed: "Inspection Passed",
  inspection_failed: "Inspection Failed",
  return_completed: "Return Completed",
  completed: "Return Completed",
  rejected: "Return Rejected",
  cancelled: "Return Cancelled",
};

export const REFUND_STATUS_LABELS: Record<string, string> = {
  not_eligible: "Not Eligible",
  pending_review: "Pending Review",
  approved: "Approved for Disbursement",
  awaiting_payout: "Awaiting Payout Execution",
  pending_payout: "Awaiting Payout Execution",
  payout_recorded: "Payout Initiated / In Progress",
  payout_initiated: "Payout Initiated / In Progress",
  paid: "Refund Paid & Settled",
  failed: "Payout Transfer Failed",
  disputed: "Disputed by Customer",
  cancelled: "Refund Cancelled",
};

export const EXCHANGE_STATUS_LABELS: Record<string, string> = {
  requested: "Exchange Requested",
  under_review: "Under Review",
  approved: "Exchange Approved",
  replacement_created: "Replacement Order Created",
  dispatched: "Replacement Dispatched",
  completed: "Exchange Completed",
  rejected: "Exchange Declined",
  cancelled: "Exchange Cancelled",
};

/**
 * Returns the list of permitted next physical statuses.
 */
export function getAllowedReturnTransitions(currentStatus: string): string[] {
  return VALID_RETURN_TRANSITIONS[currentStatus] || [];
}

/**
 * Returns the list of permitted next refund statuses.
 */
export function getAllowedRefundTransitions(currentStatus: string): RefundStatus[] {
  return VALID_REFUND_TRANSITIONS[currentStatus as RefundStatus] || [];
}

/**
 * Validates whether a physical return status transition is allowed.
 */
export function validateReturnTransition(
  currentStatus: string,
  targetStatus: string,
  allowAdminOverride: boolean = false
): { valid: boolean; error?: string; allowedNext: string[] } {
  const validNext = VALID_RETURN_TRANSITIONS[currentStatus] || [];

  if (currentStatus === targetStatus) {
    return { valid: true, allowedNext: validNext };
  }

  if (validNext.includes(targetStatus)) {
    return { valid: true, allowedNext: validNext };
  }

  if (
    currentStatus === "return_completed" ||
    currentStatus === "completed" ||
    currentStatus === "rejected" ||
    currentStatus === "cancelled"
  ) {
    if (!allowAdminOverride) {
      return {
        valid: false,
        error: `Physical return is in a terminal state ('${currentStatus}') and cannot be transitioned further.`,
        allowedNext: [],
      };
    }
  }

  if (allowAdminOverride) {
    return { valid: true, allowedNext: validNext };
  }

  return {
    valid: false,
    error: `Cannot transition return from '${currentStatus.replace(/_/g, " ")}' to '${targetStatus.replace(/_/g, " ")}'. Allowed next stages: ${validNext.join(", ") || "None (Terminal)"}.`,
    allowedNext: validNext,
  };
}

/**
 * Validates whether a refund settlement status transition is allowed.
 */
export function validateRefundTransition(
  currentStatus: string,
  targetStatus: string,
  allowAdminOverride: boolean = false
): { valid: boolean; error?: string; allowedNext: RefundStatus[] } {
  const validNext = VALID_REFUND_TRANSITIONS[currentStatus as RefundStatus] || [];

  if (currentStatus === targetStatus) {
    return { valid: true, allowedNext: validNext };
  }

  if (validNext.includes(targetStatus as RefundStatus)) {
    return { valid: true, allowedNext: validNext };
  }

  if (allowAdminOverride) {
    return { valid: true, allowedNext: validNext };
  }

  return {
    valid: false,
    error: `Cannot transition refund from '${currentStatus.replace(/_/g, " ")}' to '${targetStatus.replace(/_/g, " ")}'. Allowed next stages: ${validNext.join(", ") || "None (Terminal)"}.`,
    allowedNext: validNext,
  };
}

/**
 * Safely masks sensitive bank account or payment details before exposing to responses.
 */
export function maskDestinationDetails(details: any): any {
  if (!details || typeof details !== "object") return details;
  const masked = { ...details };

  if (masked.accountNumber && typeof masked.accountNumber === "string") {
    const raw = masked.accountNumber.trim();
    if (raw.length > 4) {
      const last4 = raw.slice(-4);
      masked.accountNumber = `****${last4}`;
    }
  }

  return masked;
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
