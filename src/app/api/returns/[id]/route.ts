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

    // 3. Idempotent Payout Guard & Deduplication
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

    if (data.refundStatus === "paid" || data.status === "refund_processed") {
      updates.refundStatus = "paid";
      updates.refundProcessedAt = now;
      updates.refundDisbursedAt = now;
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

    // Determine timeline message for original order
    const nextStatus = data.status || existingReturn.status;
    const nextRefundStatus = updates.refundStatus || existingReturn.refundStatus;
    let customerTimelineMsg = data.customerInstructions?.trim() || `Return #${existingReturn.returnReference} updated to ${nextStatus.replace(/_/g, " ")}.`;

    if (data.status === "approved") {
      customerTimelineMsg = `Return #${existingReturn.returnReference} approved! Pickup partner will be assigned shortly.`;
    } else if (data.status === "rejected") {
      customerTimelineMsg = `Return #${existingReturn.returnReference} declined. Reason: ${data.rejectionReason || existingReturn.rejectionReason}.`;
    } else if (data.status === "pickup_scheduled") {
      const carrier = data.courierName || existingReturn.courierName || "Pickup Associate";
      customerTimelineMsg = `Return #${existingReturn.returnReference} pickup scheduled with ${carrier}. Expected: ${data.expectedPickupDate || "Soon"}.`;
    } else if (data.status === "picked_up") {
      customerTimelineMsg = `Return #${existingReturn.returnReference} items picked up by courier. En route to Bishnu Studio.`;
    } else if (data.status === "received_at_studio" || data.status === "received") {
      customerTimelineMsg = `Return #${existingReturn.returnReference} received at Bishnu Studio. Inspection will commence.`;
    } else if (data.inspectionResult === "passed") {
      customerTimelineMsg = `Return #${existingReturn.returnReference} items passed physical inspection. Eligible for refund settlement.`;
    } else if (data.inspectionResult === "failed") {
      customerTimelineMsg = `Return #${existingReturn.returnReference} items failed inspection: ${data.inspectionNotes || "Does not match return conditions"}.`;
    } else if (updates.refundStatus === "paid" || data.status === "refund_processed") {
      const payoutAmount = data.refundAmount !== undefined ? data.refundAmount : (existingReturn.refundAmount || 0);
      const payoutRef = updates.refundTransactionReference || existingReturn.refundTransactionReference || "Verified";
      customerTimelineMsg = `Refund of ₹${(payoutAmount || 0).toFixed(2)} disbursed for Return #${existingReturn.returnReference}. Payout Ref: ${payoutRef}.`;
    }

    const isPaidRefund = updates.refundStatus === "paid" || data.status === "refund_processed";

    await recordOrderEvent({
      orderId: existingReturn.orderId,
      previousStatus: "completed",
      newStatus: "completed",
      previousPaymentStatus: "paid",
      newPaymentStatus: isPaidRefund ? "refunded" : "paid",
      changedByUserId: auth.user.id,
      actorRole: "admin",
      customerMessage: customerTimelineMsg,
      internalNote: data.internalNotes?.trim() || `Return #${existingReturn.returnReference} updated by ${auth.user.email} (Physical: ${nextStatus}, Refund: ${nextRefundStatus}).`,
    });

    if (isPaidRefund) {
      await db
        .update(orders)
        .set({ paymentStatus: "refunded", updatedAt: now })
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
        restocked: updates.restocked,
        refundRef: updates.refundTransactionReference,
        proofUrl: updates.refundProofUrl,
      },
    });

    // Customer Notification
    if (data.status || data.refundStatus) {
      try {
        const { createNotification } = await import("@/lib/notifications");
        const notifTitle = isPaidRefund
          ? `Refund Disbursed for Return #${existingReturn.returnReference}`
          : `Return #${existingReturn.returnReference}: ${nextStatus.replace(/_/g, " ").toUpperCase()}`;

        await createNotification({
          recipientType: "customer",
          recipientId: existingReturn.customerId,
          category: "return",
          eventType: isPaidRefund ? "refund_paid" : `return_${nextStatus}`,
          title: notifTitle,
          message: customerTimelineMsg,
          entityType: "return",
          entityId: id,
          linkUrl: `/account/orders/${existingReturn.orderId}`,
          priority: isPaidRefund || data.status === "approved" ? "high" : "normal",
          deduplicationKey: `notif_return_${id}_${nextStatus}_${nextRefundStatus}`,
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
    });
  } catch (error: any) {
    console.error("Update return error:", error);
    return NextResponse.json(
      { error: "Failed to update return request" },
      { status: 500 }
    );
  }
}
