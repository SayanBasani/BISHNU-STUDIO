import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { products, productCategories } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { eq, desc, asc } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateStockSchema = z.object({
  productId: z.string(),
  stockQuantity: z.number().int().min(0).optional(),
  delta: z.number().int().optional(),
  isAvailable: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        price: products.price,
        discountedPrice: products.discountedPrice,
        stockQuantity: products.stockQuantity,
        isAvailable: products.isAvailable,
        categoryId: products.categoryId,
        categoryName: productCategories.name,
        updatedAt: products.updatedAt,
      })
      .from(products)
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .orderBy(asc(products.stockQuantity));

    return NextResponse.json({ products: rows });
  } catch (error: any) {
    console.error("Inventory fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch inventory stock." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validation = updateStockSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { productId, stockQuantity, delta, isAvailable } = validation.data;

    const existing = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const prod = existing[0];
    let newStock = prod.stockQuantity;

    if (stockQuantity !== undefined) {
      newStock = stockQuantity;
    } else if (delta !== undefined) {
      newStock = Math.max(0, prod.stockQuantity + delta);
    }

    const updates: Record<string, any> = {
      stockQuantity: newStock,
      updatedAt: Date.now(),
    };

    if (isAvailable !== undefined) {
      updates.isAvailable = isAvailable;
    } else {
      // Auto-toggle available if stock depleted or replenished
      if (newStock === 0) updates.isAvailable = false;
      else if (newStock > 0 && !prod.isAvailable) updates.isAvailable = true;
    }

    await db.update(products).set(updates).where(eq(products.id, productId));

    await logAuditEvent({
      userId: auth.user.id,
      action: "adjust_stock",
      entityType: "product",
      entityId: productId,
      details: {
        productName: prod.name,
        previousStock: prod.stockQuantity,
        newStock,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Stock updated successfully",
      newStock,
    });
  } catch (error: any) {
    console.error("Stock update error:", error);
    return NextResponse.json(
      { error: "Failed to update stock." },
      { status: 500 }
    );
  }
}
