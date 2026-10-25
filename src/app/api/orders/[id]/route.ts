import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import {
  orders,
  orderItems,
  orderFiles,
  users,
  paymentSubmissions,
  productReviews,
} from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { getOrderTimeline, recordOrderEvent } from "@/lib/order-timeline";
import { validateOrderTransition, validateTrackingUrl } from "@/lib/order-state-machine";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateOrderStatusSchema = z.object({
  orderStatus: z
    .enum([
      "pending",
      "confirmed",
      "processing",
      "ready_for_collection",
      "out_for_delivery",
      "completed",
      "cancelled",
    ])
    .optional(),
  paymentStatus: z
    .enum(["unpaid", "pending", "paid", "refunded", "failed"])
    .optional(),
  internalNotes: z.string().optional().nullable(),
  trackingNumber: z.string().optional().nullable(),
  trackingUrl: z.string().optional().nullable(),
  courierName: z.string().optional().nullable(),
  deliveryPersonName: z.string().optional().nullable(),
  deliveryPersonPhone: z.string().optional().nullable(),
  expectedDeliveryDate: z.string().optional().nullable(),
  customerFulfillmentNote: z.string().optional().nullable(),
  fulfillmentStatus: z
    .enum([
      "unfulfilled",
      "preparing",
      "ready_for_pickup",
      "in_transit",
      "out_for_delivery",
      "delivered",
      "failed_delivery",
    ])
    .optional(),
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

    // Fetch order
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (orderRows.length === 0) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const order = orderRows[0];
    const isAdmin = auth.user.role === "admin" || auth.user.role === "staff";

    // Strictly enforce ownership
    if (!isAdmin && order.customerId !== auth.user.id) {
      return NextResponse.json(
        { error: "Forbidden. You do not have permission to view this order." },
        { status: 403 }
      );
    }

    // Fetch order items
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id));

    // Fetch associated files
    const files = await db
      .select({
        id: orderFiles.id,
        orderItemId: orderFiles.orderItemId,
        originalFilename: orderFiles.originalFilename,
        fileSize: orderFiles.fileSize,
        mimeType: orderFiles.mimeType,
        fileCategory: orderFiles.fileCategory,
        pageCount: orderFiles.pageCount,
        createdAt: orderFiles.createdAt,
      })
      .from(orderFiles)
      .where(eq(orderFiles.orderId, id));

    // Fetch customer info
    let customerInfo = null;
    const custRows = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
      })
      .from(users)
      .where(eq(users.id, order.customerId))
      .limit(1);

    if (custRows.length > 0) {
      customerInfo = custRows[0];
    }

    // Fetch customer's reviews for items in this order
    const existingReviews = await db
      .select()
      .from(productReviews)
      .where(eq(productReviews.customerId, auth.user.id));

    const reviewByProductId = new Map(existingReviews.map((r) => [r.productId, r]));

    // Parse JSON configurations and attach file download links
    const parsedItems = items.map((item) => ({
      ...item,
      configuration: JSON.parse(item.configurationJson || "{}"),
      userReview: item.productId ? reviewByProductId.get(item.productId) || null : null,
      files: files
        .filter((f) => f.orderItemId === item.id)
        .map((f) => ({
          ...f,
          downloadUrl: `/api/files/download/${f.id}`,
        })),
    }));

    // Fetch timeline and payment submissions
    const rawTimeline = await getOrderTimeline(id);
    const timeline = rawTimeline.map((ev) => ({
      ...ev,
      internalNote: isAdmin ? ev.internalNote : undefined,
    }));

    const submissions = await db
      .select()
      .from(paymentSubmissions)
      .where(eq(paymentSubmissions.orderId, id))
      .orderBy(desc(paymentSubmissions.createdAt));

    const latestPaymentSubmission = submissions.length > 0 ? submissions[0] : null;

    // Delivery address parsing & missing validation
    let shippingAddress = null;
    try {
      if (order.shippingAddressJson) {
        shippingAddress = JSON.parse(order.shippingAddressJson);
      }
    } catch (e) {}

    const isHomeDelivery = order.deliveryType === "home_delivery";
    const isAddressMissing =
      isHomeDelivery &&
      (!shippingAddress ||
        !shippingAddress.houseBuilding?.trim() ||
        !shippingAddress.cityTown?.trim() ||
        !shippingAddress.pinCode?.trim());

    // Payment reconciliation calculations
    const verifiedSubmissions = submissions.filter((s) => s.status === "verified");
    const amountPaid =
      order.paymentStatus === "paid"
        ? order.totalAmount
        : verifiedSubmissions.reduce(
            (sum, s) => sum + ((s as any).amountClaimed || (s as any).amount || 0),
            0
          );
    const amountRemaining = Math.max(0, order.totalAmount - amountPaid);

    return NextResponse.json({
      success: true,
      order: {
        ...order,
        internalNotes: isAdmin ? order.internalNotes : undefined,
        shippingAddress,
        isAddressMissing,
        amountPaid,
        amountRemaining,
        items: parsedItems,
        customer: customerInfo,
        timeline,
        latestPaymentSubmission,
        paymentSubmissions: submissions,
      },
    });
  } catch (error) {
    console.error("Fetch order detail error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve order details" },
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
    const validation = updateOrderStatusSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const {
      orderStatus,
      paymentStatus,
      internalNotes,
      trackingNumber,
      trackingUrl,
      courierName,
      deliveryPersonName,
      deliveryPersonPhone,
      expectedDeliveryDate,
      customerFulfillmentNote,
      fulfillmentStatus,
      allowAdminOverride,
    } = validation.data;

    const existing = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const existingOrder = existing[0];

    // Enforce validated state machine transitions (Phase 5.2)
    if (orderStatus && orderStatus !== existingOrder.orderStatus) {
      const transitionValidation = validateOrderTransition(
        existingOrder.orderStatus,
        orderStatus,
        Boolean(allowAdminOverride)
      );
      if (!transitionValidation.valid) {
        return NextResponse.json(
          { error: transitionValidation.error },
          { status: 400 }
        );
      }
    }

    // Enforce safe tracking URL validation (Phase 4.2)
    let validatedTrackingUrl: string | null | undefined = undefined;
    if (trackingUrl !== undefined) {
      const urlCheck = validateTrackingUrl(trackingUrl);
      if (!urlCheck.valid) {
        return NextResponse.json({ error: urlCheck.error }, { status: 400 });
      }
      validatedTrackingUrl = urlCheck.safeUrl;
    }

    const updates: Record<string, any> = { updatedAt: Date.now() };

    if (orderStatus) {
      updates.orderStatus = orderStatus;
      if (orderStatus === "out_for_delivery" && !existingOrder.dispatchedAt) {
        updates.dispatchedAt = Date.now();
      }
      if (orderStatus === "completed" && !existingOrder.deliveredAt) {
        updates.deliveredAt = Date.now();
      }
    }

    if (paymentStatus) {
      updates.paymentStatus = paymentStatus;
    }

    if (internalNotes !== undefined) {
      updates.internalNotes = internalNotes?.trim() || null;
    }

    if (customerFulfillmentNote !== undefined) {
      updates.customerFulfillmentNote = customerFulfillmentNote?.trim() || null;
    }

    if (trackingNumber !== undefined) {
      updates.trackingNumber = trackingNumber?.trim() || null;
      if (trackingNumber && !existingOrder.dispatchedAt && !updates.dispatchedAt) {
        updates.dispatchedAt = Date.now();
      }
    }

    if (validatedTrackingUrl !== undefined) {
      updates.trackingUrl = validatedTrackingUrl;
    }

    if (courierName !== undefined) {
      updates.courierName = courierName?.trim() || null;
    }

    if (deliveryPersonName !== undefined) {
      updates.deliveryPersonName = deliveryPersonName?.trim() || null;
    }

    if (deliveryPersonPhone !== undefined) {
      updates.deliveryPersonPhone = deliveryPersonPhone?.trim() || null;
    }

    if (expectedDeliveryDate !== undefined) {
      updates.expectedDeliveryDate = expectedDeliveryDate?.trim() || null;
    }

    if (fulfillmentStatus) {
      updates.fulfillmentStatus = fulfillmentStatus;
    } else if (orderStatus) {
      // Automatic alignment with lifecycle stage if not explicitly overridden
      if (orderStatus === "processing") updates.fulfillmentStatus = "preparing";
      else if (orderStatus === "ready_for_collection") updates.fulfillmentStatus = "ready_for_pickup";
      else if (orderStatus === "out_for_delivery") updates.fulfillmentStatus = "out_for_delivery";
      else if (orderStatus === "completed") updates.fulfillmentStatus = "delivered";
    }

    await db.update(orders).set(updates).where(eq(orders.id, id));

    // Determine customer timeline message
    let customerMsg = customerFulfillmentNote?.trim() || `Order status updated to ${
      (orderStatus || existingOrder.orderStatus).replace(/_/g, " ")
    }.`;

    if (!customerFulfillmentNote?.trim()) {
      if (orderStatus === "confirmed") {
        customerMsg = "Order confirmed. Our team has verified order specifications.";
      } else if (orderStatus === "processing") {
        customerMsg = "Your print order is actively being processed in our studio.";
      } else if (orderStatus === "ready_for_collection") {
        customerMsg = "Your order is ready for counter pickup at our studio!";
      } else if (orderStatus === "out_for_delivery") {
        const carrier = courierName || existingOrder.courierName;
        const track = trackingNumber || existingOrder.trackingNumber;
        customerMsg = `Your order has been dispatched!${
          carrier ? ` Carrier: ${carrier}.` : ""
        }${track ? ` Tracking ID: ${track}` : ""}`;
      } else if (orderStatus === "completed") {
        customerMsg = "Order completed and delivered. Thank you for your business!";
      } else if (orderStatus === "cancelled") {
        customerMsg = "Order has been cancelled.";
      } else if (trackingNumber && trackingNumber !== existingOrder.trackingNumber) {
        customerMsg = `Tracking details updated: ${courierName || existingOrder.courierName || "Courier"} Tracking Ref #${trackingNumber}`;
      }
    }

    await recordOrderEvent({
      orderId: id,
      previousStatus: existingOrder.orderStatus,
      newStatus: orderStatus || existingOrder.orderStatus,
      previousPaymentStatus: existingOrder.paymentStatus,
      newPaymentStatus: paymentStatus || existingOrder.paymentStatus,
      changedByUserId: auth.user.id,
      actorRole: "admin",
      customerMessage: customerMsg,
      internalNote:
        internalNotes !== undefined
          ? (internalNotes?.trim() || null)
          : undefined,
    });

    await logAuditEvent({
      userId: auth.user.id,
      action: "order_status_updated",
      entityType: "order",
      entityId: id,
      details: {
        orderReference: existingOrder.orderReference,
        previousStatus: existingOrder.orderStatus,
        newStatus: orderStatus || existingOrder.orderStatus,
        paymentStatus: paymentStatus || existingOrder.paymentStatus,
        trackingNumber: updates.trackingNumber,
        trackingUrl: updates.trackingUrl,
        courierName: updates.courierName,
        deliveryPersonName: updates.deliveryPersonName,
        expectedDeliveryDate: updates.expectedDeliveryDate,
        customerFulfillmentNote: updates.customerFulfillmentNote,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Order updated successfully",
    });
  } catch (error: any) {
    console.error("Update order error:", error);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}
