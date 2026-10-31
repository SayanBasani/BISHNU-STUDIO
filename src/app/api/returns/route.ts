import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import {
  orders,
  orderItems,
  orderReturns,
  orderReturnItems,
  users,
  products,
} from "@/db/schema";
import {
  generateReturnReference,
  evaluateOrderReturnEligibility,
  maskDestinationDetails,
} from "@/lib/return-state-machine";
import { getShopSettings } from "@/lib/settings";
import { logAuditEvent } from "@/lib/audit";
import { recordOrderEvent } from "@/lib/order-timeline";
import { recordMutationIfInFallback } from "@/lib/db-sync";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const createReturnSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  reason: z.enum([
    "damaged",
    "wrong_item",
    "defective",
    "print_specification_mismatch",
    "missing_parts",
    "other",
  ]),
  customerDescription: z
    .string()
    .min(10, "Please provide a detailed description (minimum 10 characters)."),
  requestedResolution: z.enum(["refund", "exchange"]).default("refund"),
  pickupMethod: z.enum(["courier_pickup", "counter_dropoff"]).default("courier_pickup"),
  refundMethod: z.enum(["upi", "bank_transfer", "cash"]).optional(),
  refundDestination: z
    .object({
      upiId: z.string().trim().optional(),
      accountHolderName: z.string().trim().optional(),
      accountNumber: z.string().trim().optional(),
      ifsc: z.string().trim().toUpperCase().optional(),
      bankName: z.string().trim().optional(),
      counterLocation: z.string().trim().optional(),
      contactPhone: z.string().trim().optional(),
    })
    .optional(),
  evidenceUrls: z.array(z.string()).optional(),
  items: z
    .array(
      z.object({
        orderItemId: z.string().min(1),
        quantity: z.number().int().min(1),
      })
    )
    .min(1, "At least one item must be selected for return."),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json(
        { error: "Authentication required to submit a return request." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const validation = createReturnSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const {
      orderId,
      reason,
      customerDescription,
      requestedResolution,
      pickupMethod,
      refundMethod,
      refundDestination,
      evidenceUrls,
      items: requestedReturnItems,
    } = validation.data;

    // Fetch order
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (orderRows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orderRows[0];
    const isAdmin = auth.user.role === "admin" || auth.user.role === "staff";

    // Strictly enforce ownership (only customer who placed order or admin)
    if (!isAdmin && order.customerId !== auth.user.id) {
      return NextResponse.json(
        { error: "Forbidden. You can only request returns on your own orders." },
        { status: 403 }
      );
    }

    // Fetch shop return settings
    const settings = await getShopSettings();
    const returnWindowDays = settings.returnWindowDays || 7;

    // Fetch order items
    const allOrderItems = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // Fetch existing return items for this order to prevent duplicate return quantities
    const existingReturns = await db
      .select({
        orderItemId: orderReturnItems.orderItemId,
        quantity: orderReturnItems.quantity,
        status: orderReturns.status,
      })
      .from(orderReturnItems)
      .innerJoin(orderReturns, eq(orderReturnItems.returnId, orderReturns.id))
      .where(eq(orderReturns.orderId, orderId));

    // Evaluate eligibility
    const eligibility = evaluateOrderReturnEligibility(
      order,
      allOrderItems,
      existingReturns,
      returnWindowDays
    );

    if (!eligibility.isEligible) {
      return NextResponse.json(
        { error: eligibility.reason || "This order is not eligible for return." },
        { status: 400 }
      );
    }

    // Validate requested items and calculate eligible refund snapshot
    const itemMap = new Map(allOrderItems.map((i) => [i.id, i]));
    const eligibilityMap = new Map(
      eligibility.returnableItems.map((i) => [i.orderItemId, i])
    );

    let calculatedRefundAmount = 0;
    const validatedItemsToReturn: Array<{
      id: string;
      orderItemId: string;
      productId: string | null;
      quantity: number;
      unitPriceSnapshot: number;
      totalPriceSnapshot: number;
    }> = [];

    for (const reqItem of requestedReturnItems) {
      const orderItem = itemMap.get(reqItem.orderItemId);
      if (!orderItem) {
        return NextResponse.json(
          { error: `Item #${reqItem.orderItemId} does not belong to this order.` },
          { status: 400 }
        );
      }

      const itemEligibility = eligibilityMap.get(reqItem.orderItemId);
      if (!itemEligibility || itemEligibility.eligibleQuantity < reqItem.quantity) {
        return NextResponse.json(
          {
            error: `Requested return quantity (${reqItem.quantity}) exceeds remaining eligible quantity (${itemEligibility?.eligibleQuantity || 0}).`,
          },
          { status: 400 }
        );
      }

      const itemTotal = orderItem.unitPriceSnapshot * reqItem.quantity;
      calculatedRefundAmount += itemTotal;

      validatedItemsToReturn.push({
        id: `reti_${crypto.randomUUID()}`,
        orderItemId: orderItem.id,
        productId: orderItem.productId || null,
        quantity: reqItem.quantity,
        unitPriceSnapshot: orderItem.unitPriceSnapshot,
        totalPriceSnapshot: itemTotal,
      });
    }

    const returnId = `ret_${crypto.randomUUID()}`;
    const returnReference = generateReturnReference();
    const now = Date.now();

    const returnData = {
      id: returnId,
      returnReference,
      orderId,
      customerId: order.customerId,
      status: "requested" as any,
      reason,
      customerDescription: customerDescription.trim(),
      requestedResolution: requestedResolution as any,
      pickupMethod: pickupMethod as any,
      evidenceUrlsJson: evidenceUrls && evidenceUrls.length > 0 ? JSON.stringify(evidenceUrls) : null,
      refundAmount: calculatedRefundAmount,
      refundStatus: "pending_review" as any,
      refundMethod: (refundMethod || (pickupMethod === "counter_dropoff" ? "cash" : "upi")) as any,
      refundDestinationJson: refundDestination ? JSON.stringify(refundDestination) : null,
      restocked: false,
      createdAt: now,
      updatedAt: now,
    };

    // Insert return record
    await db.insert(orderReturns).values(returnData);
    await recordMutationIfInFallback(db, {
      entityType: "order_returns",
      entityId: returnId,
      operation: "INSERT",
      payload: returnData,
    });

    // Insert return items
    for (const vItem of validatedItemsToReturn) {
      const returnItemData = {
        id: vItem.id,
        returnId,
        orderItemId: vItem.orderItemId,
        productId: vItem.productId,
        quantity: vItem.quantity,
        unitPriceSnapshot: vItem.unitPriceSnapshot,
        totalPriceSnapshot: vItem.totalPriceSnapshot,
        createdAt: now,
      };
      await db.insert(orderReturnItems).values(returnItemData);
      await recordMutationIfInFallback(db, {
        entityType: "order_return_items",
        entityId: vItem.id,
        operation: "INSERT",
        payload: returnItemData,
      });
    }

    // Record order timeline event
    await recordOrderEvent({
      orderId,
      eventType: requestedResolution === "exchange" ? "exchange_requested" : "return_requested",
      returnId,
      previousStatus: order.orderStatus,
      newStatus: requestedResolution === "exchange" ? "exchange_requested" : "return_requested",
      previousPaymentStatus: order.paymentStatus,
      newPaymentStatus: order.paymentStatus,
      changedByUserId: auth.user.id,
      actorRole: isAdmin ? "admin" : "customer",
      customerMessage: requestedResolution === "exchange"
        ? `Exchange requested (${returnReference}) for ${validatedItemsToReturn.length} item(s). Reason: ${reason.replace(/_/g, " ")}.`
        : `Return requested (${returnReference}) for ${validatedItemsToReturn.length} item(s). Reason: ${reason.replace(/_/g, " ")}.`,
      internalNote: `Return #${returnReference} created by ${auth.user.email}. Est. refund: ₹${calculatedRefundAmount.toFixed(2)}.`,
    });

    // Audit log
    await logAuditEvent({
      userId: auth.user.id,
      action: "return_requested",
      entityType: "order",
      entityId: orderId,
      details: {
        returnId,
        returnReference,
        reason,
        refundAmount: calculatedRefundAmount,
        itemCount: validatedItemsToReturn.length,
      },
    });

    // Dispatch persistent notifications
    try {
      const { createNotification } = await import("@/lib/notifications");
      // Admin notification: Opens matching admin return detail page (/admin/returns/[returnId])
      await createNotification({
        recipientType: "admin",
        category: "return",
        eventType: "return_requested",
        title: `Return Requested (${returnReference})`,
        message: `Customer requested a return for Order #${order.orderReference} (${reason.replace(/_/g, " ")}). Est. refund: ₹${calculatedRefundAmount.toFixed(2)}.`,
        entityType: "return",
        entityId: returnId,
        linkUrl: `/admin/returns/${returnId}`,
        priority: "high",
        deduplicationKey: `notif_admin_return_${returnId}`,
      });

      // Customer notification
      await createNotification({
        recipientType: "customer",
        recipientId: order.customerId,
        category: "return",
        eventType: "return_requested",
        title: `Return Request Submitted (${returnReference})`,
        message: `Your return request #${returnReference} for Order #${order.orderReference} has been submitted and is under review.`,
        entityType: "return",
        entityId: returnId,
        linkUrl: `/account/orders/${orderId}#return-${returnId}`,
        deduplicationKey: `notif_cust_return_${returnId}`,
      });
    } catch (notifErr) {
      console.error("Failed to dispatch return request notifications:", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: "Return request submitted successfully. Our team will review your request.",
      returnReference,
      returnId,
    });
  } catch (error: any) {
    console.error("Create return request error:", error);
    return NextResponse.json(
      { error: "Failed to submit return request" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("orderId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const offset = (page - 1) * limit;

    const isAdmin = auth.user.role === "admin" || auth.user.role === "staff";

    // Build query conditions
    const conditions = [];

    // Ownership check: regular customer only sees their own returns
    if (!isAdmin) {
      conditions.push(eq(orderReturns.customerId, auth.user.id));
    }

    if (orderId) {
      conditions.push(eq(orderReturns.orderId, orderId));
    }

    if (status && status !== "all") {
      conditions.push(eq(orderReturns.status, status as any));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch paginated returns
    const returnRows = await db
      .select({
        id: orderReturns.id,
        returnReference: orderReturns.returnReference,
        orderId: orderReturns.orderId,
        customerId: orderReturns.customerId,
        status: orderReturns.status,
        reason: orderReturns.reason,
        requestedResolution: orderReturns.requestedResolution,
        pickupMethod: orderReturns.pickupMethod,
        refundAmount: orderReturns.refundAmount,
        refundStatus: orderReturns.refundStatus,
        refundMethod: orderReturns.refundMethod,
        refundProofUrl: orderReturns.refundProofUrl,
        refundTransactionReference: orderReturns.refundTransactionReference,
        refundDestinationJson: orderReturns.refundDestinationJson,
        refundDisbursedAt: orderReturns.refundDisbursedAt,
        refundDisputeReason: orderReturns.refundDisputeReason,
        refundDisputedAt: orderReturns.refundDisputedAt,
        courierName: orderReturns.courierName,
        trackingNumber: orderReturns.trackingNumber,
        trackingUrl: orderReturns.trackingUrl,
        customerInstructions: orderReturns.customerInstructions,
        internalNotes: isAdmin ? orderReturns.internalNotes : sql<string>`NULL`,
        createdAt: orderReturns.createdAt,
        updatedAt: orderReturns.updatedAt,
      })
      .from(orderReturns)
      .where(whereClause)
      .orderBy(desc(orderReturns.createdAt))
      .limit(limit)
      .offset(offset);

    // Count total for pagination
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(orderReturns)
      .where(whereClause);

    const total = Number(totalCount[0]?.count || 0);

    const mappedReturns = returnRows.map((r) => {
      let destination: any = null;
      try {
        if (r.refundDestinationJson) {
          destination = maskDestinationDetails(JSON.parse(r.refundDestinationJson));
        }
      } catch {}
      const { refundDestinationJson, ...safeReturn } = r;
      return {
        ...safeReturn,
        refundDestination: destination,
      };
    });

    return NextResponse.json({
      success: true,
      returns: mappedReturns,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error: any) {
    console.error("Fetch returns list error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve return requests" },
      { status: 500 }
    );
  }
}
