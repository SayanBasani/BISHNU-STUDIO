import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { db } from "@/db";
import { productCategories, products } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { recordMutationIfInFallback } from "@/lib/db-sync";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateCategorySchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();
    const validation = updateCategorySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {};
    if (validation.data.name) updates.name = validation.data.name.trim();
    if (validation.data.slug)
      updates.slug = validation.data.slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    if (validation.data.description !== undefined)
      updates.description = validation.data.description?.trim() || null;
    if (validation.data.sortOrder !== undefined)
      updates.sortOrder = validation.data.sortOrder;

    await db.update(productCategories).set(updates).where(eq(productCategories.id, id));

    await recordMutationIfInFallback(db, {
      entityType: "product_categories",
      entityId: id,
      operation: "UPDATE",
      payload: {
        id,
        ...updates,
      },
    });

    await logAuditEvent({
      userId: auth.user.id,
      action: "update_category",
      entityType: "product",
      entityId: id,
      details: updates,
    });

    return NextResponse.json({
      success: true,
      message: "Category updated successfully",
    });
  } catch (error: any) {
    console.error("Update category error:", error);
    return NextResponse.json(
      { error: "Failed to update category." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await getAuthSession();
    if (!auth?.user || auth.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Check if products exist in category
    const attachedProducts = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.categoryId, id))
      .limit(1);

    if (attachedProducts.length > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete this category because active products are assigned to it. Reassign or delete the products first.",
        },
        { status: 400 }
      );
    }

    await db.delete(productCategories).where(eq(productCategories.id, id));

    await recordMutationIfInFallback(db, {
      entityType: "product_categories",
      entityId: id,
      operation: "DELETE",
      payload: { id },
    });

    await logAuditEvent({
      userId: auth.user.id,
      action: "delete_category",
      entityType: "product",
      entityId: id,
    });

    return NextResponse.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete category error:", error);
    return NextResponse.json(
      { error: "Failed to delete category." },
      { status: 500 }
    );
  }
}
