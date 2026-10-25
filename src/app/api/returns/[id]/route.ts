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
import { validateReturnTransition } from "@/lib/return-state-machine";
import { logAuditEvent } from "@/lib/audit";
import { recordOrderEvent } from "@/lib/order-timeline";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateReturnSchema = z.object({
  status: z
    .enum([
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
    ])
    .optional(),
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

    // Fetch return items
    const items = await db
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
      .where(eq(orderReturnItems.returnId, id));

    // Fetch customer details
    const customerRows = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
      })
      .from(users)
      .where(eq(users.id, ret.customerId))
      .limit(1);

    // Fetch associated order
    const orderRows = await db
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
      .limit(1);

    // Parse evidence URLs
    let evidenceUrls: string[] = [];
    try {
      if (ret.evidenceUrlsJson) evidenceUrls = JSON.parse(ret.evidenceUrlsJson);
    } catch {}

    return NextResponse.json({
      success: true,
      returnRecord: {
        ...ret,
        evidenceUrls,
        // Critical privacy protection: internal staff notes are never exposed to customer
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

    // Enforce validated state machine transitions
    if (data.status && data.status !== existingReturn.status) {
      const transitionCheck = validateReturnTransition(
        existingReturn.status,
        data.status,
        Boolean(data.allowAdminOverride)
      );
      if (!transitionCheck.valid) {
        return NextResponse.json(
          { error: transitionCheck.error },
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

    if (data.refundAmount !== undefined) updates.refundAmount = data.refundAmount;
    if (data.refundMethod !== undefined) updates.refundMethod = data.refundMethod;
    if (data.refundTransactionReference !== undefined) {
      updates.refundTransactionReference = data.refundTransactionReference?.trim() || null;
      if (data.refundTransactionReference?.trim() && !existingReturn.refundProcessedAt) {
        updates.refundProcessedAt = now;
      }
    }

    // Idempotent inventory restocking (Phase 6.6)
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
    let customerTimelineMsg = data.customerInstructions?.trim() || `Return #${existingReturn.returnReference} updated to ${nextStatus.replace(/_/g, " ")}.`;

    if (data.status === "approved") {
      customerTimelineMsg = `Return #${existingReturn.returnReference} approved! Pickup partner will be assigned shortly.`;
    } else if (data.status === "rejected") {
      customerTimelineMsg = `Return #${existingReturn.returnReference} declined. Reason: ${data.rejectionReason || existingReturn.rejectionReason}.`;
    } else if (data.status === "pickup_scheduled") {
      const carrier = data.courierName || existingReturn.courierName || "Pickup Associate";
      customerTimelineMsg = `Return #${existingReturn.returnReference} pickup scheduled with ${carrier}. Expected: ${data.expectedPickupDate || "Soon"}.`;
    } else if (data.status === "refund_processed") {
      customerTimelineMsg = `Refund of ₹${(data.refundAmount || existingReturn.refundAmount || 0).toFixed(2)} processed for Return #${existingReturn.returnReference}. Ref: ${data.refundTransactionReference || "Bank Transfer"}.`;
    }

    await recordOrderEvent({
      orderId: existingReturn.orderId,
      previousStatus: "completed",
      newStatus: "completed",
      previousPaymentStatus: "paid",
      newPaymentStatus: data.status === "refund_processed" ? "refunded" : "paid",
      changedByUserId: auth.user.id,
      actorRole: "admin",
      customerMessage: customerTimelineMsg,
      internalNote: data.internalNotes?.trim() || `Return #${existingReturn.returnReference} updated to ${nextStatus} by ${auth.user.email}.`,
    });

    await logAuditEvent({
      userId: auth.user.id,
      action: "return_status_updated",
      entityType: "order",
      entityId: existingReturn.orderId,
      details: {
        returnId: id,
        returnReference: existingReturn.returnReference,
        newStatus: nextStatus,
        restocked: updates.restocked,
        refundRef: updates.refundTransactionReference,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Return request updated successfully",
    });
  } catch (error: any) {
    console.error("Update return error:", error);
    return NextResponse.json(
      { error: "Failed to update return request" },
      { status: 500 }
    );
  }
}
