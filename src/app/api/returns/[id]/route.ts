import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import {
  orders,
  orderItems,
  orderReturns,
  orderReturnItems,
  products,
  users,
} from "@/db/schema";
import { validateTrackingUrl } from "@/lib/order-state-machine";
import {
  PHYSICAL_RETURN_STATUSES,
  REFUND_STATUSES,
  getAllowedReturnTransitions,
  getAllowedRefundTransitions,
  validateReturnTransition,
  validateRefundTransition,
  maskDestinationDetails,
  evaluateReturnCaseClosure,
} from "@/lib/return-state-machine";
import { logAuditEvent } from "@/lib/audit";
import { recordOrderEvent } from "@/lib/order-timeline";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateReturnSchema = z.object({
  status: z.enum(PHYSICAL_RETURN_STATUSES as unknown as [string, ...string[]]).optional(),
  refundStatus: z.enum(REFUND_STATUSES as unknown as [string, ...string[]]).optional(),
  rejectionReason: z.string().optional().nullable(),
  pickupMethod: z.enum(["courier_pickup", "counter_dropoff"]).optional(),
  courierName: z.string().optional().nullable(),
  trackingNumber: z.string().optional().nullable(),
  trackingUrl: z.string().optional().nullable(),
  deliveryPersonName: z.string().optional().nullable(),
  deliveryPersonPhone: z.string().optional().nullable(),
  expectedPickupDate: z.string().optional().nullable(),
  customerInstructions: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  inspectionResult: z.enum(["passed", "failed", "partial", "pending"]).optional().nullable(),
  inspectionNotes: z.string().optional().nullable(),
  refundAmount: z.number().min(0).optional().nullable(),
  refundMethod: z.enum(["upi", "bank_transfer", "cash"]).optional().nullable(),
  refundTransactionReference: z.string().optional().nullable(),
  refundProofUrl: z.string().optional().nullable(),
  refundDestination: z.any().optional(),
  refundDisputeReason: z.string().optional().nullable(),
  replacementOrderId: z.string().optional().nullable(),
  exchangeStatus: z.enum([
    "requested",
    "under_review",
    "approved",
    "replacement_created",
    "dispatched",
    "completed",
    "rejected",
    "cancelled",
  ] as unknown as [string, ...string[]]).optional(),
  exchangePriceDifference: z.number().optional(),
  exchangeNotes: z.string().optional().nullable(),
  action: z.enum([
    "update",
    "approve_refund",
    "record_payout",
    "record_payout_initiated",
    "confirm_payout_completed",
    "record_payout_failed",
    "reject_refund",
    "approve_exchange",
    "record_replacement_order",
    "archive_case",
    "unarchive_case",
  ]).optional(),
  payoutFailureReason: z.string().optional().nullable(),
  confirmationChecked: z.boolean().optional(),
  payoutTimestamp: z.union([z.number(), z.string()]).optional().nullable(),
  isArchived: z.boolean().optional(),
  payoutConfirmed: z.boolean().optional(),
  restockInventory: z.boolean().optional(),
  allowAdminOverride: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const returnRows = await db
      .select()
      .from(orderReturns)
      .where(eq(orderReturns.id, id))
      .limit(1);

    if (returnRows.length === 0) {
      return NextResponse.json({ error: "Return record not found" }, { status: 404 });
    }

    const ret = returnRows[0];
    const isAdmin = auth.user.role === "admin" || auth.user.role === "staff";

    // Strictly enforce ownership
    if (!isAdmin && ret.customerId !== auth.user.id) {
      return NextResponse.json(
        { error: "Forbidden. You do not have permission to view this return." },
        { status: 403 }
      );
    }

    // Parallel fetch related details
    const [items, customerRows, orderRows] = await Promise.all([
      db
        .select({
          id: orderReturnItems.id,
          orderItemId: orderReturnItems.orderItemId,
          productId: orderReturnItems.productId,
          quantity: orderReturnItems.quantity,
          unitPriceSnapshot: orderReturnItems.unitPriceSnapshot,
          totalPriceSnapshot: orderReturnItems.totalPriceSnapshot,
          productName: products.name,
        })
        .from(orderReturnItems)
        .leftJoin(products, eq(orderReturnItems.productId, products.id))
        .where(eq(orderReturnItems.returnId, id)),

      db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
        })
        .from(users)
        .where(eq(users.id, ret.customerId))
        .limit(1),

      db
        .select({
          id: orders.id,
          orderReference: orders.orderReference,
          orderStatus: orders.orderStatus,
          paymentStatus: orders.paymentStatus,
          totalAmount: orders.totalAmount,
          createdAt: orders.createdAt,
          deliveredAt: orders.deliveredAt,
        })
        .from(orders)
        .where(eq(orders.id, ret.orderId))
        .limit(1),
    ]);

    // Parse evidence URLs
    let evidenceUrls: string[] = [];
    try {
      if (ret.evidenceUrlsJson) evidenceUrls = JSON.parse(ret.evidenceUrlsJson);
    } catch {}

    // Parse destination details safely
    let destinationDetails: any = null;
    try {
      if (ret.refundDestinationJson) {
        destinationDetails = maskDestinationDetails(JSON.parse(ret.refundDestinationJson));
      }
    } catch {}

    const safeRet = { ...ret };
    delete (safeRet as any).refundDestinationJson; // Do not expose unmasked raw string

    return NextResponse.json({
      success: true,
      returnRecord: {
        ...safeRet,
        evidenceUrls,
        refundDestination: destinationDetails,
        allowedPhysicalTransitions: getAllowedReturnTransitions(ret.status),
        allowedRefundTransitions: getAllowedRefundTransitions(ret.refundStatus || "pending_review"),
        caseEvaluation: evaluateReturnCaseClosure(ret),
        isArchived: Boolean(ret.isArchived),
        archivedAt: ret.archivedAt || null,
        // Privacy protection: staff notes are admin-only
        internalNotes: isAdmin ? ret.internalNotes : undefined,
        items,
        customer: customerRows[0] || null,
        order: orderRows[0] || null,
      },
    });
  } catch (error: any) {
    console.error("Fetch return detail error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve return details" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || (auth.user.role !== "admin" && auth.user.role !== "staff")) {
      return NextResponse.json(
        { error: "Forbidden. Admin authorization required." },
        { status: 403 }
      );
    }

    const { id } = params;
    const body = await req.json();
    const validation = updateReturnSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Normalize explicit actions
    if (data.action === "approve_refund") {
      data.refundStatus = "approved";
    } else if (data.action === "record_payout_initiated") {
      data.refundStatus = "payout_initiated";
    } else if (data.action === "confirm_payout_completed") {
      data.refundStatus = "paid";
    } else if (data.action === "record_payout_failed") {
      data.refundStatus = "payout_failed";
    } else if (data.action === "archive_case") {
      data.isArchived = true;
    } else if (data.action === "unarchive_case") {
      data.isArchived = false;
    }

    const existingRows = await db
      .select()
      .from(orderReturns)
      .where(eq(orderReturns.id, id))
      .limit(1);

    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Return record not found" }, { status: 404 });
    }

    const existingReturn = existingRows[0];

    // 1. Enforce validated physical state machine transitions
    if (data.status && data.status !== existingReturn.status) {
      const transitionCheck = validateReturnTransition(
        existingReturn.status,
        data.status,
        Boolean(data.allowAdminOverride)
      );
      if (!transitionCheck.valid) {
        return NextResponse.json(
          {
            error: transitionCheck.error,
            allowedNextStatuses: transitionCheck.allowedNext,
            currentStatus: existingReturn.status,
          },
          { status: 400 }
        );
      }
    }

    // 2. Enforce validated refund state machine transitions
    if (data.refundStatus && data.refundStatus !== existingReturn.refundStatus) {
      const refundTransitionCheck = validateRefundTransition(
        existingReturn.refundStatus || "pending_review",
        data.refundStatus,
        Boolean(data.allowAdminOverride)
      );
      if (!refundTransitionCheck.valid) {
        return NextResponse.json(
          {
            error: refundTransitionCheck.error,
            allowedNextRefundStatuses: refundTransitionCheck.allowedNext,
            currentRefundStatus: existingReturn.refundStatus,
          },
          { status: 400 }
        );
      }
    }

    // 3. Validation for Payout Failed
    if (data.refundStatus === "payout_failed") {
      const failureReason = data.payoutFailureReason?.trim() || data.customerInstructions?.trim();
      if (!failureReason) {
        return NextResponse.json(
          { error: "A clear failure reason is mandatory when recording a failed refund payout." },
          { status: 400 }
        );
      }
    }

    // 4. Case Archiving Rules
    if (data.isArchived === true) {
      const caseClosure = evaluateReturnCaseClosure({
        status: data.status || existingReturn.status,
        refundStatus: data.refundStatus || existingReturn.refundStatus,
        exchangeStatus: data.exchangeStatus || existingReturn.exchangeStatus,
        requestedResolution: existingReturn.requestedResolution,
        isArchived: false,
      });

      if (!caseClosure.canArchive && !data.allowAdminOverride) {
        return NextResponse.json(
          {
            error: `Cannot archive return case: ${caseClosure.closureReason} Physical return must be completed or case must be resolved.`,
          },
          { status: 400 }
        );
      }
    }

    // 5. Idempotent Payout Guard, Ceiling Calculation & Deduplication
    if (data.refundStatus === "paid" || data.status === "refund_processed") {
      // Check if already paid
      if (
        (existingReturn.refundStatus === "paid" || existingReturn.status === "refund_processed") &&
        !data.allowAdminOverride
      ) {
        return NextResponse.json(
          {
            error: "Refund has already been paid and settled. Re-disbursement is prevented to avoid duplicate payouts.",
          },
          { status: 400 }
        );
      }

      // Explicit confirmation checkbox required
      if (data.confirmationChecked === false && !data.allowAdminOverride) {
        return NextResponse.json(
          {
            error: "You must check the confirmation checkbox to verify that payout was completed.",
          },
          { status: 400 }
        );
      }

      // Ensure payout transaction reference is provided
      const payoutRef = data.refundTransactionReference?.trim() || existingReturn.refundTransactionReference?.trim();
      if (!payoutRef) {
        return NextResponse.json(
          {
            error: "A valid payout transaction reference (UTR, UPI reference, or signed Cash voucher number) is required to record payout.",
          },
          { status: 400 }
        );
      }

      // Ensure payout proof URL or signed receipt is provided
      const payoutProof = data.refundProofUrl?.trim() || existingReturn.refundProofUrl?.trim();
      if (!payoutProof && !data.allowAdminOverride) {
        return NextResponse.json(
          {
            error: "Valid payout proof (screenshot URL or signed voucher image) is mandatory before marking a refund as paid.",
          },
          { status: 400 }
        );
      }

      // Check transaction reference uniqueness across different returns
      const duplicateRef = await db
        .select({ id: orderReturns.id, returnReference: orderReturns.returnReference })
        .from(orderReturns)
        .where(
          and(
            eq(orderReturns.refundTransactionReference, payoutRef),
            sql`${orderReturns.id} != ${id}`
          )
        )
        .limit(1);

      if (duplicateRef.length > 0) {
        return NextResponse.json(
          {
            error: `Duplicate payout reference '${payoutRef}' was already recorded on Return #${duplicateRef[0].returnReference}. Each payout reference must be unique.`,
          },
          { status: 400 }
        );
      }

      // Recalculate eligible refund amount from return items and verify ceiling
      const returnItemsList = await db
        .select()
        .from(orderReturnItems)
        .where(eq(orderReturnItems.returnId, id));

      const eligibleItemsTotal = returnItemsList.reduce(
        (acc, item) => acc + (item.totalPriceSnapshot || 0),
        0
      );

      const orderRows = await db
        .select()
        .from(orders)
        .where(eq(orders.id, existingReturn.orderId))
        .limit(1);
      const parentOrder = orderRows[0];
      const maxAllowed = eligibleItemsTotal > 0 ? eligibleItemsTotal : (parentOrder?.totalAmount ?? 0);

      const proposedAmount = data.refundAmount !== undefined && data.refundAmount !== null
        ? data.refundAmount
        : (existingReturn.refundAmount ?? maxAllowed);

      if (proposedAmount > maxAllowed + 0.05 && !data.allowAdminOverride) {
        return NextResponse.json(
          {
            error: `Refund payout amount (₹${proposedAmount.toFixed(2)}) cannot exceed the eligible return value (₹${maxAllowed.toFixed(2)}).`,
          },
          { status: 400 }
        );
      }
    }

    // Rejection rule: Mandatory rejection reason
    if (data.status === "rejected") {
      const reason = data.rejectionReason?.trim() || existingReturn.rejectionReason?.trim();
      if (!reason) {
        return NextResponse.json(
          { error: "A clear rejection reason is mandatory when declining a return request." },
          { status: 400 }
        );
      }
    }

    // Validate tracking URL if provided
    let validatedTrackingUrl: string | null | undefined = undefined;
    if (data.trackingUrl !== undefined) {
      const urlCheck = validateTrackingUrl(data.trackingUrl);
      if (!urlCheck.valid) {
        return NextResponse.json({ error: urlCheck.error }, { status: 400 });
      }
      validatedTrackingUrl = urlCheck.safeUrl;
    }

    const now = Date.now();
    const updates: Record<string, any> = { updatedAt: now };

    // Physical return updates
    if (data.status) updates.status = data.status;
    if (data.rejectionReason !== undefined) updates.rejectionReason = data.rejectionReason?.trim() || null;
    if (data.pickupMethod) updates.pickupMethod = data.pickupMethod;
    if (data.courierName !== undefined) updates.courierName = data.courierName?.trim() || null;
    if (data.trackingNumber !== undefined) updates.trackingNumber = data.trackingNumber?.trim() || null;
    if (validatedTrackingUrl !== undefined) updates.trackingUrl = validatedTrackingUrl;
    if (data.deliveryPersonName !== undefined) updates.deliveryPersonName = data.deliveryPersonName?.trim() || null;
    if (data.deliveryPersonPhone !== undefined) updates.deliveryPersonPhone = data.deliveryPersonPhone?.trim() || null;
    if (data.expectedPickupDate !== undefined) updates.expectedPickupDate = data.expectedPickupDate?.trim() || null;
    if (data.customerInstructions !== undefined) updates.customerInstructions = data.customerInstructions?.trim() || null;
    if (data.internalNotes !== undefined) updates.internalNotes = data.internalNotes?.trim() || null;
    if (data.inspectionResult !== undefined) updates.inspectionResult = data.inspectionResult || null;
    if (data.inspectionNotes !== undefined) updates.inspectionNotes = data.inspectionNotes?.trim() || null;

    // Financial refund updates
    if (data.refundStatus) updates.refundStatus = data.refundStatus;
    if (data.refundAmount !== undefined) updates.refundAmount = data.refundAmount;
    if (data.refundMethod !== undefined) updates.refundMethod = data.refundMethod;
    if (data.refundProofUrl !== undefined) updates.refundProofUrl = data.refundProofUrl?.trim() || null;
    if (data.refundDestination) updates.refundDestinationJson = JSON.stringify(data.refundDestination);
    if (data.refundDisputeReason !== undefined) {
      updates.refundDisputeReason = data.refundDisputeReason?.trim() || null;
      if (data.refundDisputeReason?.trim()) {
        updates.refundDisputedAt = now;
      }
    }

    if (data.refundTransactionReference !== undefined) {
      updates.refundTransactionReference = data.refundTransactionReference?.trim() || null;
    }

    // Exchange tracking updates
    if (data.replacementOrderId !== undefined) {
      updates.replacementOrderId = data.replacementOrderId?.trim() || null;
    }
    if (data.exchangeStatus !== undefined) {
      updates.exchangeStatus = data.exchangeStatus;
    }
    if (data.exchangePriceDifference !== undefined) {
      updates.exchangePriceDifference = data.exchangePriceDifference;
    }
    if (data.exchangeNotes !== undefined) {
      updates.exchangeNotes = data.exchangeNotes?.trim() || null;
    }

    // Archival updates
    if (data.isArchived !== undefined) {
      updates.isArchived = data.isArchived;
      updates.archivedAt = data.isArchived ? now : null;
    }

    if (data.refundStatus === "paid" || data.status === "refund_processed") {
      updates.refundStatus = "paid";
      updates.refundProcessedAt = now;
      updates.refundDisbursedAt = data.payoutTimestamp ? new Date(data.payoutTimestamp).getTime() : now;
      updates.refundDisbursedByUserId = auth.user.id;
    } else if (data.refundStatus === "payout_failed") {
      updates.refundStatus = "payout_failed";
      const failureReason = data.payoutFailureReason?.trim();
      if (failureReason) {
        updates.internalNotes = existingReturn.internalNotes
          ? `${existingReturn.internalNotes}\n[Payout Failed]: ${failureReason}`
          : `[Payout Failed]: ${failureReason}`;
      }
    } else if (data.refundStatus === "approved" || data.refundStatus === "awaiting_payout" || data.refundStatus === "payout_initiated") {
      updates.refundStatus = data.refundStatus;
      updates.refundDisbursedByUserId = auth.user.id;
    }

    // Auto-update refund status based on inspection or rejection if not explicitly passed
    if (!data.refundStatus) {
      if (data.status === "rejected" || data.inspectionResult === "failed") {
        updates.refundStatus = "not_eligible";
      } else if (data.inspectionResult === "passed" && existingReturn.refundStatus === "pending_review") {
        updates.refundStatus = "approved";
      }
    }

    // Idempotent inventory restocking
    if (data.restockInventory && !existingReturn.restocked) {
      const returnItemsList = await db
        .select()
        .from(orderReturnItems)
        .where(eq(orderReturnItems.returnId, id));

      for (const rItem of returnItemsList) {
        if (rItem.productId) {
          await db
            .update(products)
            .set({
              stockQuantity: sql`${products.stockQuantity} + ${rItem.quantity}`,
              updatedAt: now,
            })
            .where(eq(products.id, rItem.productId));
        }
      }

      updates.restocked = true;
      updates.restockedAt = now;
    }

    // Apply updates to return record
    await db.update(orderReturns).set(updates).where(eq(orderReturns.id, id));

    // Determine semantic eventType for timeline
    let eventType: string = "return_status_updated";
    if (data.isArchived === true) {
      eventType = "case_archived";
    } else if (updates.refundStatus === "paid") {
      eventType = "refund_paid";
    } else if (updates.refundStatus === "payout_initiated") {
      eventType = "refund_payout_initiated";
    } else if (updates.refundStatus === "payout_failed") {
      eventType = "refund_payout_failed";
    } else if (updates.refundStatus === "approved") {
      eventType = "refund_approved";
    } else if (data.status === "approved") {
      eventType = "return_approved";
    } else if (data.status === "pickup_scheduled") {
      eventType = "return_pickup_scheduled";
    } else if (data.status === "picked_up") {
      eventType = "return_picked_up";
    } else if (data.status === "received_at_studio" || data.status === "received") {
      eventType = "return_item_received";
    } else if (data.inspectionResult === "passed") {
      eventType = "return_inspection_passed";
    } else if (data.inspectionResult === "failed") {
      eventType = "return_inspection_failed";
    } else if (data.status === "return_completed" || data.status === "completed") {
      eventType = "return_completed";
    } else if (data.status === "rejected") {
      eventType = "return_rejected";
    } else if (data.status === "cancelled") {
      eventType = "return_cancelled";
    } else if (data.action === "approve_exchange") {
      eventType = "exchange_approved";
    } else if (data.replacementOrderId) {
      eventType = "replacement_order_created";
    }

    // Next statuses
    const nextStatus = data.status || existingReturn.status;
    const nextRefundStatus = updates.refundStatus || existingReturn.refundStatus;

    // Customer-friendly clear messaging
    let customerTimelineMsg = data.customerInstructions?.trim() || "";
    if (!customerTimelineMsg) {
      if (eventType === "case_archived") {
        customerTimelineMsg = `Return #${existingReturn.returnReference} case concluded and archived.`;
      } else if (eventType === "refund_paid") {
        const amt = updates.refundAmount !== undefined ? updates.refundAmount : (existingReturn.refundAmount || 0);
        const ref = updates.refundTransactionReference || existingReturn.refundTransactionReference || "Verified";
        const meth = (updates.refundMethod || existingReturn.refundMethod || "UPI/Bank").toUpperCase();
        customerTimelineMsg = `Refund sent successfully! ₹${(amt || 0).toFixed(2)} disbursed via ${meth} (Ref: ${ref}). Bank settlement may take 1-3 business days.`;
      } else if (eventType === "refund_payout_initiated") {
        const amt = updates.refundAmount !== undefined ? updates.refundAmount : (existingReturn.refundAmount || 0);
        customerTimelineMsg = `Refund transfer initiated for ₹${(amt || 0).toFixed(2)}. Processing through banking rails.`;
      } else if (eventType === "refund_payout_failed") {
        const rsn = data.payoutFailureReason?.trim() || "Banking rail rejected transaction";
        customerTimelineMsg = `Refund transfer failed (${rsn}). Our finance team will retry settlement shortly.`;
      } else if (eventType === "refund_approved") {
        const amt = updates.refundAmount !== undefined ? updates.refundAmount : (existingReturn.refundAmount || 0);
        customerTimelineMsg = `Refund approved for ₹${(amt || 0).toFixed(2)}. Scheduled for disbursement.`;
      } else if (eventType === "return_approved") {
        customerTimelineMsg = `Return #${existingReturn.returnReference} approved! Pickup partner will be assigned shortly.`;
      } else if (eventType === "return_pickup_scheduled") {
        const carrier = data.courierName || existingReturn.courierName || "Pickup Partner";
        customerTimelineMsg = `Return pickup scheduled with ${carrier}. Expected date: ${data.expectedPickupDate || "Soon"}.`;
      } else if (eventType === "return_picked_up") {
        customerTimelineMsg = `Return items collected by pickup partner. En route to return location.`;
      } else if (eventType === "return_item_received") {
        customerTimelineMsg = `Return items received at return facility. Inspection will begin shortly.`;
      } else if (eventType === "return_inspection_passed") {
        customerTimelineMsg = `Return items passed quality inspection. Approved for resolution settlement.`;
      } else if (eventType === "return_inspection_failed") {
        customerTimelineMsg = `Return items failed inspection: ${data.inspectionNotes || "Does not meet return condition standards"}.`;
      } else if (eventType === "return_completed") {
        customerTimelineMsg = `Physical return process completed for #${existingReturn.returnReference}.`;
      } else if (eventType === "return_rejected") {
        customerTimelineMsg = `Return #${existingReturn.returnReference} declined. Reason: ${data.rejectionReason || existingReturn.rejectionReason}.`;
      } else {
        customerTimelineMsg = `Return #${existingReturn.returnReference} updated to ${nextStatus.replace(/_/g, " ")}.`;
      }
    }

    // Fetch parent order to preserve its legitimate orderStatus and compute paymentStatus
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, existingReturn.orderId))
      .limit(1);
    const parentOrder = orderRows[0];
    const originalOrderStatus = parentOrder?.orderStatus || "delivered";
    const originalPaymentStatus = parentOrder?.paymentStatus || "paid";

    const isPaidRefund = updates.refundStatus === "paid" || data.status === "refund_processed";
    const nextPaymentStatus = isPaidRefund ? "refunded" : originalPaymentStatus;

    // Record order event without corrupting order status to "completed"
    await recordOrderEvent({
      orderId: existingReturn.orderId,
      eventType,
      returnId: id,
      previousStatus: originalOrderStatus,
      newStatus: originalOrderStatus,
      previousPaymentStatus: originalPaymentStatus,
      newPaymentStatus: nextPaymentStatus,
      changedByUserId: auth.user.id,
      actorRole: "admin",
      customerMessage: customerTimelineMsg,
      internalNote: data.internalNotes?.trim() || `Return #${existingReturn.returnReference} updated by ${auth.user.email} (Physical: ${nextStatus}, Refund: ${nextRefundStatus}).`,
    });

    if (isPaidRefund && parentOrder) {
      await db
        .update(orders)
        .set({ paymentStatus: nextPaymentStatus, updatedAt: now })
        .where(eq(orders.id, existingReturn.orderId));
    }

    await logAuditEvent({
      userId: auth.user.id,
      action: "return_status_updated",
      entityType: "order",
      entityId: existingReturn.orderId,
      details: {
        returnId: id,
        returnReference: existingReturn.returnReference,
        physicalStatus: nextStatus,
        refundStatus: nextRefundStatus,
        isArchived: updates.isArchived,
        restocked: updates.restocked,
        refundRef: updates.refundTransactionReference,
        proofUrl: updates.refundProofUrl,
      },
    });

    // Customer Notification
    if (data.status || data.refundStatus || data.isArchived !== undefined) {
      try {
        const { createNotification } = await import("@/lib/notifications");
        let notifTitle = `Return #${existingReturn.returnReference} Update`;
        if (eventType === "refund_paid") {
          notifTitle = `Refund Sent Successfully (${existingReturn.returnReference})`;
        } else if (eventType === "refund_payout_initiated") {
          notifTitle = `Refund Transfer Initiated (${existingReturn.returnReference})`;
        } else if (eventType === "refund_payout_failed") {
          notifTitle = `Refund Settlement Delay (${existingReturn.returnReference})`;
        } else if (eventType === "refund_approved") {
          notifTitle = `Refund Approved (${existingReturn.returnReference})`;
        } else if (eventType === "return_approved") {
          notifTitle = `Return Request Approved (${existingReturn.returnReference})`;
        }

        await createNotification({
          recipientType: "customer",
          recipientId: existingReturn.customerId,
          category: "return",
          eventType,
          title: notifTitle,
          message: customerTimelineMsg,
          entityType: "return",
          entityId: id,
          linkUrl: `/account/orders/${existingReturn.orderId}#return-${id}`,
          priority: isPaidRefund || data.status === "approved" || eventType === "refund_payout_failed" ? "high" : "normal",
          deduplicationKey: `notif_return_${id}_${nextStatus}_${nextRefundStatus}_${eventType}`,
        });
      } catch (notifErr) {
        console.error("Failed to dispatch return status notification:", notifErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Return request updated successfully",
      updatedStatus: nextStatus,
      updatedRefundStatus: nextRefundStatus,
      isArchived: updates.isArchived ?? existingReturn.isArchived,
    });
  } catch (error: any) {
    console.error("Update return error:", error);
    return NextResponse.json(
      { error: "Failed to update return request" },
      { status: 500 }
    );
  }
}
