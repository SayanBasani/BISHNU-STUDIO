import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { orders, orderItems, products } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { recordMutationIfInFallback } from "@/lib/db-sync";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, id))
      .limit(1);

    if (orderRows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orderRows[0];
    const isAdmin = auth.user.role === "admin" || auth.user.role === "staff";

    if (!isAdmin && order.customerId !== auth.user.id) {
      return NextResponse.json(
        { error: "Forbidden. You cannot cancel this order." },
        { status: 403 }
      );
    }

    // Cancellation business rule: can only cancel if still 'pending'
    if (order.orderStatus !== "pending") {
      return NextResponse.json(
        {
          error: `Order cannot be cancelled because it is already "${order.orderStatus.replace(/_/g, " ")}". Please contact the shop directly at 9876543210.`,
        },
        { status: 400 }
      );
    }

    // Update status to cancelled
    const cancelNow = Date.now();
    await db
      .update(orders)
      .set({
        orderStatus: "cancelled",
        updatedAt: cancelNow,
      })
      .where(eq(orders.id, id));

    await recordMutationIfInFallback(db, {
      entityType: "orders",
      entityId: id,
      operation: "UPDATE",
      payload: {
        id,
        orderStatus: "cancelled",
        updatedAt: cancelNow,
      },
    });

    // Return products to inventory if any
    const items = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id));

    for (const item of items) {
      if (item.productId && item.quantity > 0) {
        const prod = await db
          .select({ stock: products.stockQuantity })
          .from(products)
          .where(eq(products.id, item.productId))
          .limit(1);

        if (prod.length > 0) {
          const newStock = prod[0].stock + item.quantity;
          await db
            .update(products)
            .set({ stockQuantity: newStock, updatedAt: cancelNow })
            .where(eq(products.id, item.productId));

          await recordMutationIfInFallback(db, {
            entityType: "products",
            entityId: item.productId,
            operation: "UPDATE",
            payload: {
              id: item.productId,
              stockQuantity: newStock,
              updatedAt: cancelNow,
            },
          });
        }
      }
    }

    await logAuditEvent({
      userId: auth.user.id,
      action: "order_cancelled",
      entityType: "order",
      entityId: id,
      details: { orderReference: order.orderReference },
    });

    // Dispatch persistent notifications
    try {
      const { createNotification } = await import("@/lib/notifications");
      // Customer notification
      await createNotification({
        recipientType: "customer",
        recipientId: order.customerId,
        category: "order",
        eventType: "order_cancelled",
        title: `Order Cancelled (${order.orderReference})`,
        message: `Order #${order.orderReference} has been cancelled successfully.`,
        entityType: "order",
        entityId: id,
        linkUrl: `/account/orders/${id}`,
        deduplicationKey: `notif_order_cancelled_${id}`,
      });

      // Admin notification
      await createNotification({
        recipientType: "admin",
        category: "order",
        eventType: "order_cancelled",
        title: `Order Cancelled (${order.orderReference})`,
        message: `Order #${order.orderReference} was cancelled by ${isAdmin ? "administrator" : "customer"}.`,
        entityType: "order",
        entityId: id,
        linkUrl: `/admin/orders/${id}`,
        priority: "high",
        deduplicationKey: `notif_admin_order_cancelled_${id}`,
      });
    } catch (notifErr) {
      console.error("Failed to dispatch order cancellation notifications:", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: "Order has been cancelled successfully.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to cancel order" },
      { status: 500 }
    );
  }
}
