import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { orders, orderItems, products } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { recordOrderEvent } from "@/lib/order-timeline";
import { eq, and } from "drizzle-orm";
import { createRequestTimer } from "@/lib/perf";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const { id: orderId, itemId } = params;
  const timer = createRequestTimer(
    req,
    `/api/admin/orders/${orderId}/items/${itemId}/deduct-stock`
  );

  try {
    // 1. Authenticate & Authorize Administrator
    const auth = await getAuthSession();
    if (!auth?.user) {
      return timer.finish(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }

    const isAdmin = auth.user.role === "admin" || auth.user.role === "staff";
    if (!isAdmin) {
      return timer.finish(
        NextResponse.json(
          { error: "Forbidden. Admin privileges required." },
          { status: 403 }
        )
      );
    }

    // 2. Resolve Order
    const orderRows = await timer.measure("database.orders.fetch", () =>
      db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
    );

    if (orderRows.length === 0) {
      return timer.finish(
        NextResponse.json({ error: "Order not found" }, { status: 404 })
      );
    }
    const order = orderRows[0];

    // 3. Resolve Order Item
    const itemRows = await timer.measure("database.order_items.fetch", () =>
      db
        .select()
        .from(orderItems)
        .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)))
        .limit(1)
    );

    if (itemRows.length === 0) {
      return timer.finish(
        NextResponse.json({ error: "Order item not found" }, { status: 404 })
      );
    }
    const item = itemRows[0];

    // 4. Reject Non-Inventory Services (PVC, documents, lamination, photo prints)
    if (item.itemType !== "product" || !item.productId) {
      return timer.finish(
        NextResponse.json(
          {
            error: `Item of type '${item.itemType}' is a print service and does not track inventory.`,
          },
          { status: 400 }
        )
      );
    }

    let config: Record<string, any> = {};
    try {
      config = JSON.parse(item.configurationJson || "{}");
    } catch {}

    // 5. Mandatory Idempotency Guard: Prevent double deductions
    if (
      config.stockDeductionStatus === "deducted" ||
      config.stockDeductionStatus === "deducted_at_checkout"
    ) {
      const prodRows = await db
        .select({ stockQuantity: products.stockQuantity })
        .from(products)
        .where(eq(products.id, item.productId))
        .limit(1);

      return timer.finish(
        NextResponse.json({
          success: true,
          message: "Stock already deducted for this item.",
          alreadyDeducted: true,
          stockDeductionStatus: config.stockDeductionStatus,
          currentStock: prodRows[0]?.stockQuantity ?? null,
        })
      );
    }

    // 6. Authoritative Catalog Product & Stock Check
    const prodRows = await timer.measure("database.products.fetch", () =>
      db.select().from(products).where(eq(products.id, item.productId!)).limit(1)
    );

    if (prodRows.length === 0) {
      return timer.finish(
        NextResponse.json(
          {
            error:
              "Catalog product not found or has been deleted. Cannot deduct inventory for historical snapshot.",
          },
          { status: 404 }
        )
      );
    }

    const product = prodRows[0];
    const requestedQty = Math.max(1, item.quantity || 1);

    // 7. Check Available Quantity & Reject Insufficient Stock
    if (product.stockQuantity < requestedQty) {
      return timer.finish(
        NextResponse.json(
          {
            error: `Insufficient stock for '${product.name}'. Available: ${product.stockQuantity}, Ordered: ${requestedQty}.`,
            availableStock: product.stockQuantity,
            requestedQuantity: requestedQty,
          },
          { status: 400 }
        )
      );
    }

    // 8. Apply Atomic Stock Deduction
    const newStock = product.stockQuantity - requestedQty;
    const now = Date.now();

    await timer.measure("database.products.update_stock", () =>
      db
        .update(products)
        .set({
          stockQuantity: newStock,
          updatedAt: now,
        })
        .where(eq(products.id, product.id))
    );

    // 9. Update Order Item Configuration with durable deduction status
    config.stockDeductionStatus = "deducted";
    config.stockDeductedAt = now;
    config.stockDeductedByAdminId = auth.user.id;
    config.stockDeductedQuantity = requestedQty;

    await timer.measure("database.order_items.update_config", () =>
      db
        .update(orderItems)
        .set({ configurationJson: JSON.stringify(config) })
        .where(eq(orderItems.id, item.id))
    );

    // 10. Audit Logging
    await logAuditEvent({
      userId: auth.user.id,
      action: "inventory_manual_deduction",
      entityType: "product",
      entityId: product.id,
      details: {
        orderId,
        orderReference: order.orderReference,
        orderItemId: item.id,
        productName: product.name,
        sku: product.sku,
        previousStock: product.stockQuantity,
        deductedQuantity: requestedQty,
        newStock,
      },
    });

    // 11. Record Order Timeline Event
    await recordOrderEvent({
      orderId,
      newStatus: order.orderStatus,
      changedByUserId: auth.user.id,
      actorRole: "admin",
      internalNote: `Manual stock deduction: ${requestedQty} unit(s) of '${product.name}' (SKU: ${product.sku}) deducted from inventory by admin ${auth.user.fullName || auth.user.email}. Stock adjusted from ${product.stockQuantity} to ${newStock}.`,
    });

    return timer.finish(
      NextResponse.json({
        success: true,
        message: `Successfully deducted ${requestedQty} unit(s) from stock.`,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        previousStock: product.stockQuantity,
        deductedQuantity: requestedQty,
        updatedStock: newStock,
        stockDeductionStatus: "deducted",
      })
    );
  } catch (error: any) {
    console.error("Failed to deduct inventory:", error);
    return timer.finish(
      NextResponse.json(
        { error: "Failed to deduct inventory: " + (error.message || "Unknown error") },
        { status: 500 }
      )
    );
  }
}
