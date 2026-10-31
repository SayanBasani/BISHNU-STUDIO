import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import {
  orders,
  orderItems,
  orderFiles,
  users,
  paymentSubmissions,
  productReviews,
  products,
  productImages,
  payments,
} from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { getOrderTimeline, recordOrderEvent } from "@/lib/order-timeline";
import {
  validateOrderTransition,
  validateTrackingUrl,
  CANONICAL_PAYMENT_STATUSES,
} from "@/lib/order-state-machine";
import { createRequestTimer } from "@/lib/perf";
import { eq, desc, and, or, inArray } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const paymentStatusSchema = z
  .string()
  .optional()
  .nullable()
  .refine(
    (val) => {
      if (val === undefined || val === null || val === "") return true;
      return (CANONICAL_PAYMENT_STATUSES as readonly string[]).includes(val);
    },
    (val) => {
      if (
        val === "pending_refund" ||
        val === "refund_approved" ||
        val === "refund_processed" ||
        val === "rejected_refund"
      ) {
        return {
          message: `Invalid payment status '${val}'. Returns and customer refunds are managed independently via the dedicated Returns workflow (/api/returns).`,
        };
      }
      if (val === "received") {
        return {
          message: `Invalid payment status 'received'. Expected 'paid' (confirmed received) or 'pending_verification'.`,
        };
      }
      return {
        message: `Invalid payment status '${val}'. Valid statuses are: ${CANONICAL_PAYMENT_STATUSES.join(", ")}.`,
      };
    }
  );

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
  paymentStatus: paymentStatusSchema,
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
  const timer = createRequestTimer(req, `/api/orders/${params.id}`);
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return timer.finish(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }

    const { id } = params;

    // Fetch order
    const orderRows = await timer.measure("database.orders.fetch", () =>
      db.select().from(orders).where(eq(orders.id, id)).limit(1)
    );

    if (orderRows.length === 0) {
      return timer.finish(
        NextResponse.json({ error: "Order not found" }, { status: 404 })
      );
    }

    const order = orderRows[0];
    const isAdmin = auth.user.role === "admin" || auth.user.role === "staff";

    // Strictly enforce ownership
    if (!isAdmin && order.customerId !== auth.user.id) {
      return timer.finish(
        NextResponse.json(
          { error: "Forbidden. You do not have permission to view this order." },
          { status: 403 }
        )
      );
    }

    // Parallel fetch of all order-associated sub-resources
    const [items, files, custRows, existingReviews, rawTimeline, submissions] =
      await Promise.all([
        timer.measure("database.order_items.fetch", () =>
          db.select().from(orderItems).where(eq(orderItems.orderId, id))
        ),
        timer.measure("database.order_files.fetch", () =>
          db
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
            .where(eq(orderFiles.orderId, id))
        ),
        timer.measure("database.users.fetch", () =>
          db
            .select({
              id: users.id,
              fullName: users.fullName,
              email: users.email,
              phone: users.phone,
            })
            .from(users)
            .where(eq(users.id, order.customerId))
            .limit(1)
        ),
        timer.measure("database.product_reviews.fetch", () =>
          db
            .select()
            .from(productReviews)
            .where(eq(productReviews.customerId, auth.user.id))
        ),
        timer.measure("database.timeline.fetch", () =>
          getOrderTimeline(id)
        ),
        timer.measure("database.payment_submissions.fetch", () =>
          db
            .select()
            .from(paymentSubmissions)
            .where(eq(paymentSubmissions.orderId, id))
            .orderBy(desc(paymentSubmissions.createdAt))
        ),
      ]);

    const customerInfo = custRows.length > 0 ? custRows[0] : null;
    const reviewByProductId = new Map(existingReviews.map((r) => [r.productId, r]));

    // Batch fetch catalog products and images in parallel to eliminate N+1 waterfall
    const productItemIds = items
      .filter((item) => item.itemType === "product" && item.productId)
      .map((item) => item.productId as string);
    const uniqueProductIds = Array.from(new Set(productItemIds));

    let catalogProductsMap = new Map<string, any>();
    let productImagesMap = new Map<string, string>();

    if (uniqueProductIds.length > 0) {
      const [fetchedProducts, fetchedImages] = await Promise.all([
        timer.measure("database.products.batch", () =>
          db.select().from(products).where(inArray(products.id, uniqueProductIds))
        ),
        timer.measure("database.product_images.batch", () =>
          db
            .select({
              productId: productImages.productId,
              imageUrl: productImages.imageUrl,
            })
            .from(productImages)
            .where(inArray(productImages.productId, uniqueProductIds))
        ),
      ]);

      catalogProductsMap = new Map(fetchedProducts.map((p) => [p.id, p]));
      for (const img of fetchedImages) {
        if (!productImagesMap.has(img.productId)) {
          productImagesMap.set(img.productId, img.imageUrl);
        }
      }
    }

    // Parse JSON configurations, dynamically attach resolved product catalog details and file downloads
    const parsedItems = items.map((item) => {
      let configuration: Record<string, any> = {};
      try {
        configuration = JSON.parse(item.configurationJson || "{}");
      } catch {}

      let resolvedProductName = configuration.productName || null;
      let resolvedProductSku = configuration.productSku || null;
      let resolvedProductImage = configuration.productImageUrl || null;
      let isResolvedFromCatalog = false;

      let catalogProductExists = false;
      let currentCatalogStock: number | null = null;
      let isAvailable = false;

      if (item.itemType === "product") {
        if (item.productId) {
          const catalogProd = catalogProductsMap.get(item.productId);
          const prodRows = catalogProd ? [catalogProd] : [];
          if (prodRows.length > 0) {
            catalogProductExists = true;
            currentCatalogStock = prodRows[0].stockQuantity;
            isAvailable = prodRows[0].isAvailable;

            if (!resolvedProductName) {
              resolvedProductName = prodRows[0].name;
              resolvedProductSku = prodRows[0].sku;
              isResolvedFromCatalog = true;
            }
            if (!resolvedProductSku && prodRows[0].sku) {
              resolvedProductSku = prodRows[0].sku;
            }

            if (!resolvedProductImage) {
              const imgUrl = productImagesMap.get(item.productId);
              if (imgUrl) {
                resolvedProductImage = imgUrl;
              }
            }
          } else {
            if (!resolvedProductName) {
              resolvedProductName = "Product details unavailable (historical item)";
            }
          }
        } else if (!resolvedProductName) {
          resolvedProductName = "Product details unavailable (historical item)";
        }
      }

      const stockDeductionStatus =
        item.itemType !== "product"
          ? "not_tracked"
          : configuration.stockDeductionStatus || "deducted_at_checkout";

      return {
        ...item,
        productName: resolvedProductName,
        productSku: resolvedProductSku,
        productImage: resolvedProductImage,
        isResolvedFromCatalog,
        catalogProductExists,
        currentCatalogStock,
        stockDeductionStatus,
        configuration,
        userReview: item.productId ? reviewByProductId.get(item.productId) || null : null,
        files: files
          .filter((f) => f.orderItemId === item.id)
          .map((f) => ({
            ...f,
            downloadUrl: `/api/files/download/${f.id}`,
          })),
      };
    });

    const timeline = rawTimeline.map((ev) => ({
      ...ev,
      internalNote: isAdmin ? ev.internalNote : undefined,
    }));

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
    const verifiedTotal = verifiedSubmissions.reduce(
      (sum, s) => sum + ((s as any).amountClaimed || (s as any).amount || 0),
      0
    );
    const amountPaid =
      order.paymentStatus === "paid"
        ? Math.max(order.totalAmount, verifiedTotal)
        : verifiedTotal;
    const amountRemaining = Math.max(0, order.totalAmount - amountPaid);

    return timer.finish(
      NextResponse.json({
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
      })
    );
  } catch (error) {
    console.error("Fetch order detail error:", error);
    return timer.finish(
      NextResponse.json(
        { error: "Failed to retrieve order details" },
        { status: 500 }
      )
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const timer = createRequestTimer(req, `/api/orders/${params.id}`);
  try {
    const auth = await getAuthSession();
    if (!auth?.user || (auth.user.role !== "admin" && auth.user.role !== "staff")) {
      return timer.finish(
        NextResponse.json(
          { error: "Forbidden. Admin authorization required." },
          { status: 403 }
        )
      );
    }

    const { id } = params;
    const body = await req.json();
    const validation = updateOrderStatusSchema.safeParse(body);
    if (!validation.success) {
      return timer.finish(
        NextResponse.json(
          { error: validation.error.errors[0].message },
          { status: 400 }
        )
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

    const existing = await timer.measure("database.orders.fetch", () =>
      db.select().from(orders).where(eq(orders.id, id)).limit(1)
    );

    if (existing.length === 0) {
      return timer.finish(
        NextResponse.json({ error: "Order not found" }, { status: 404 })
      );
    }

    const existingOrder = existing[0];

    // Enforce validated state machine transitions with deliveryType context
    if (orderStatus && orderStatus !== existingOrder.orderStatus) {
      const transitionValidation = validateOrderTransition(
        existingOrder.orderStatus,
        orderStatus,
        {
          allowAdminOverride: Boolean(allowAdminOverride),
          deliveryType: existingOrder.deliveryType,
          courierName: courierName || existingOrder.courierName,
          trackingNumber: trackingNumber || existingOrder.trackingNumber,
        }
      );
      if (!transitionValidation.valid) {
        return timer.finish(
          NextResponse.json(
            { error: transitionValidation.error },
            { status: 400 }
          )
        );
      }
    }

    // Enforce safe tracking URL validation
    let validatedTrackingUrl: string | null | undefined = undefined;
    if (trackingUrl !== undefined) {
      const urlCheck = validateTrackingUrl(trackingUrl);
      if (!urlCheck.valid) {
        return timer.finish(
          NextResponse.json({ error: urlCheck.error }, { status: 400 })
        );
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

    await timer.measure("database.orders.update", () =>
      db.update(orders).set(updates).where(eq(orders.id, id))
    );

    // Note (BS-ORDERS-04B audit): Manual update of order.paymentStatus (e.g. to 'paid' for cash-on-collection
    // or administrative adjustments) must NOT automatically mark pending payment claims as verified.
    // Payment claims must only be verified authoritatively via POST /api/admin/payments/[id]/verify.

    // Determine customer timeline message based on order lifecycle and delivery type
    let customerMsg = customerFulfillmentNote?.trim() || `Order status updated to ${
      (orderStatus || existingOrder.orderStatus).replace(/_/g, " ")
    }.`;

    if (!customerFulfillmentNote?.trim()) {
      if (orderStatus === "confirmed") {
        customerMsg = "Order confirmed. Our team has verified order specifications.";
      } else if (orderStatus === "processing") {
        customerMsg = "Your print order is actively being processed in our studio.";
      } else if (orderStatus === "ready_for_collection") {
        if (existingOrder.deliveryType === "home_delivery") {
          customerMsg = "Your order has been packaged and prepared for courier dispatch.";
        } else {
          customerMsg = "Your order is ready for counter pickup at our studio!";
        }
      } else if (orderStatus === "out_for_delivery") {
        const carrier = courierName || existingOrder.courierName;
        const track = trackingNumber || existingOrder.trackingNumber;
        customerMsg = `Your order has been dispatched!${
          carrier ? ` Carrier: ${carrier}.` : ""
        }${track ? ` Tracking ID: ${track}` : ""}`;
      } else if (orderStatus === "completed") {
        if (existingOrder.deliveryType === "home_delivery") {
          customerMsg = "Order delivered successfully to your doorstep. Thank you for your business!";
        } else {
          customerMsg = "Order collected at studio counter. Thank you for your business!";
        }
      } else if (orderStatus === "cancelled") {
        customerMsg = "Order has been cancelled.";
      } else if (trackingNumber && trackingNumber !== existingOrder.trackingNumber) {
        customerMsg = `Tracking details updated: ${courierName || existingOrder.courierName || "Courier"} Tracking Ref #${trackingNumber}`;
      }
    }

    // Execute timeline logging, audit logging, and customer notification concurrently in parallel
    const timelinePromise = timer.measure("database.timeline.record", () =>
      recordOrderEvent({
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
      })
    );

    const auditPromise = timer.measure("database.audit.log", () =>
      logAuditEvent({
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
      })
    );

    const notificationPromise = (async () => {
      if (
        (orderStatus && orderStatus !== existingOrder.orderStatus) ||
        (trackingNumber && trackingNumber !== existingOrder.trackingNumber)
      ) {
        try {
          const { createNotification } = await import("@/lib/notifications");
          const isDelivery =
            orderStatus === "out_for_delivery" ||
            Boolean(trackingNumber && trackingNumber !== existingOrder.trackingNumber);
          const statusLabel = (orderStatus || existingOrder.orderStatus)
            .replace(/_/g, " ")
            .toUpperCase();
          await timer.measure("notifications.dispatch", () =>
            createNotification({
              recipientType: "customer",
              recipientId: existingOrder.customerId,
              category: isDelivery ? "delivery" : "order",
              eventType: `order_${orderStatus || "updated"}`,
              title: `Order #${existingOrder.orderReference}: ${statusLabel}`,
              message: customerMsg,
              entityType: "order",
              entityId: id,
              linkUrl: `/account/orders/${id}`,
              priority:
                orderStatus === "out_for_delivery" || orderStatus === "ready_for_collection"
                  ? "high"
                  : "normal",
            })
          );
        } catch (notifErr) {
          console.error("Failed to dispatch order status notification:", notifErr);
        }
      }
    })();

    await Promise.all([timelinePromise, auditPromise, notificationPromise]);

    return timer.finish(
      NextResponse.json({
        success: true,
        message: "Order updated successfully",
      })
    );
  } catch (error: any) {
    console.error("Update order error:", error);
    return timer.finish(
      NextResponse.json(
        { error: "Failed to update order" },
        { status: 500 }
      )
    );
  }
}
