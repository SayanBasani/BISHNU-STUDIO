import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { orders, orderItems, products } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createRequestTimer } from "@/lib/perf";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const { id: orderId, itemId } = params;
  const timer = createRequestTimer(
    req,
    `/api/admin/orders/${orderId}/items/${itemId}/inventory`
  );

  try {
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
    let config: Record<string, any> = {};
    try {
      config = JSON.parse(item.configurationJson || "{}");
    } catch {}

    const isService = item.itemType !== "product" || !item.productId;
    if (isService) {
      return timer.finish(
        NextResponse.json({
          success: true,
          item: {
            id: item.id,
            itemType: item.itemType,
            productName: item.itemType.replace(/_/g, " "),
            sku: null,
            orderedQuantity: item.quantity,
            currentStock: null,
            expectedStockAfterDeduction: null,
            stockDeductionStatus: "not_tracked",
            canDeduct: false,
            message: "Print services do not have physical inventory tracking.",
          },
        })
      );
    }

    // Lookup catalog product
    const prodRows = await timer.measure("database.products.fetch", () =>
      db.select().from(products).where(eq(products.id, item.productId!)).limit(1)
    );

    if (prodRows.length === 0) {
      return timer.finish(
        NextResponse.json({
          success: true,
          item: {
            id: item.id,
            itemType: item.itemType,
            productName: config.productName || "Historical Catalog Item",
            sku: config.productSku || null,
            orderedQuantity: item.quantity,
            currentStock: null,
            expectedStockAfterDeduction: null,
            stockDeductionStatus: config.stockDeductionStatus || "unavailable",
            canDeduct: false,
            message: "Catalog product is unavailable or was removed from catalog.",
          },
        })
      );
    }

    const product = prodRows[0];
    const orderedQuantity = Math.max(1, item.quantity || 1);
    const deductionStatus =
      config.stockDeductionStatus || "deducted_at_checkout";
    const alreadyDeducted =
      deductionStatus === "deducted" || deductionStatus === "deducted_at_checkout";

    const currentStock = product.stockQuantity;
    const expectedStockAfterDeduction = Math.max(0, currentStock - orderedQuantity);
    const hasSufficientStock = currentStock >= orderedQuantity;

    return timer.finish(
      NextResponse.json({
        success: true,
        item: {
          id: item.id,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          orderedQuantity,
          currentStock,
          expectedStockAfterDeduction,
          stockDeductionStatus: deductionStatus,
          alreadyDeducted,
          hasSufficientStock,
          canDeduct: !alreadyDeducted && hasSufficientStock,
          deductedAt: config.stockDeductedAt || null,
          deductedByAdminId: config.stockDeductedByAdminId || null,
        },
      })
    );
  } catch (error: any) {
    console.error("Failed to fetch inventory item details:", error);
    return timer.finish(
      NextResponse.json(
        { error: "Failed to fetch inventory details: " + (error.message || "Unknown error") },
        { status: 500 }
      )
    );
  }
}
